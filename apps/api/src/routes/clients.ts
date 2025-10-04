import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';

export const clientRoutes = new Hono();

// All routes require authentication
clientRoutes.use('*', requireAuth);

// GET /api/v1/clients - List all clients
clientRoutes.get('/', async (c) => {
  const tenantId = c.get('tenantId');
  const db = c.env.DB as D1Database;

  try {
    const result = await db
      .prepare(`
        SELECT
          c.id,
          c.company_name,
          c.registration_number,
          c.vat_number,
          c.address,
          c.city,
          c.postal_code,
          c.country,
          c.industry,
          c.verification_status,
          c.credibility_score,
          c.created_at,
          u.email,
          u.first_name,
          u.last_name,
          (SELECT COUNT(*) FROM debts WHERE client_id = c.id) as total_debts,
          (SELECT SUM(original_amount) FROM debts WHERE client_id = c.id) as total_debt_value
        FROM clients c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.tenant_id = ?
        ORDER BY c.created_at DESC
      `)
      .bind(tenantId)
      .all();

    return c.json({ data: result.results || [] });
  } catch (error) {
    console.error('Error listing clients:', error);
    return c.json(
      { error: { code: 'DATABASE_ERROR', message: 'Failed to fetch clients' } },
      500
    );
  }
});

// POST /api/v1/clients - Create new client
clientRoutes.post('/', async (c) => {
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const db = c.env.DB as D1Database;

  try {
    const body = await c.req.json();

    // Generate IDs
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const clientUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    // Validate required fields
    if (!body.company_name || !body.email || !body.first_name || !body.last_name) {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } },
        400
      );
    }

    // Start transaction - create user first, then client
    await db
      .prepare(`
        INSERT INTO users (
          id, tenant_id, email, first_name, last_name, role,
          language, status, created_at
        ) VALUES (?, ?, ?, ?, ?, 'client', ?, 'active', ?)
      `)
      .bind(
        clientUserId,
        tenantId,
        body.email,
        body.first_name,
        body.last_name,
        body.language || 'cs',
        now
      )
      .run();

    await db
      .prepare(`
        INSERT INTO clients (
          id, tenant_id, user_id, company_name, registration_number, vat_number,
          address, city, postal_code, country, industry,
          verification_status, credibility_score, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 50, ?)
      `)
      .bind(
        clientId,
        tenantId,
        clientUserId,
        body.company_name,
        body.registration_number || null,
        body.vat_number || null,
        body.address || '',
        body.city || '',
        body.postal_code || '',
        body.country || 'CZ',
        body.industry || null,
        now
      )
      .run();

    // Fetch the created client
    const client = await db
      .prepare(`
        SELECT
          c.*,
          u.email,
          u.first_name,
          u.last_name
        FROM clients c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.id = ?
      `)
      .bind(clientId)
      .first();

    return c.json({ data: client }, 201);
  } catch (error) {
    console.error('Error creating client:', error);
    return c.json(
      { error: { code: 'DATABASE_ERROR', message: 'Failed to create client' } },
      500
    );
  }
});

// GET /api/v1/clients/:id - Get single client
clientRoutes.get('/:id', async (c) => {
  const tenantId = c.get('tenantId');
  const clientId = c.req.param('id');
  const db = c.env.DB as D1Database;

  try {
    const client = await db
      .prepare(`
        SELECT
          c.*,
          u.email,
          u.first_name,
          u.last_name,
          (SELECT COUNT(*) FROM debts WHERE client_id = c.id) as total_debts,
          (SELECT SUM(original_amount) FROM debts WHERE client_id = c.id) as total_debt_value,
          (SELECT SUM(total_paid) FROM debts WHERE client_id = c.id) as total_collected
        FROM clients c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.id = ? AND c.tenant_id = ?
      `)
      .bind(clientId, tenantId)
      .first();

    if (!client) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Client not found' } },
        404
      );
    }

    return c.json({ data: client });
  } catch (error) {
    console.error('Error fetching client:', error);
    return c.json(
      { error: { code: 'DATABASE_ERROR', message: 'Failed to fetch client' } },
      500
    );
  }
});

// PUT /api/v1/clients/:id - Update client
clientRoutes.put('/:id', async (c) => {
  const tenantId = c.get('tenantId');
  const clientId = c.req.param('id');
  const db = c.env.DB as D1Database;

  try {
    const body = await c.req.json();

    // Update client
    await db
      .prepare(`
        UPDATE clients
        SET
          company_name = ?,
          registration_number = ?,
          vat_number = ?,
          address = ?,
          city = ?,
          postal_code = ?,
          country = ?,
          industry = ?
        WHERE id = ? AND tenant_id = ?
      `)
      .bind(
        body.company_name,
        body.registration_number || null,
        body.vat_number || null,
        body.address || '',
        body.city || '',
        body.postal_code || '',
        body.country || 'CZ',
        body.industry || null,
        clientId,
        tenantId
      )
      .run();

    // Fetch updated client
    const client = await db
      .prepare(`
        SELECT
          c.*,
          u.email,
          u.first_name,
          u.last_name
        FROM clients c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.id = ? AND c.tenant_id = ?
      `)
      .bind(clientId, tenantId)
      .first();

    return c.json({ data: client });
  } catch (error) {
    console.error('Error updating client:', error);
    return c.json(
      { error: { code: 'DATABASE_ERROR', message: 'Failed to update client' } },
      500
    );
  }
});

// DELETE /api/v1/clients/:id - Delete client
clientRoutes.delete('/:id', async (c) => {
  const tenantId = c.get('tenantId');
  const clientId = c.req.param('id');
  const db = c.env.DB as D1Database;

  try {
    // Check if client has debts
    const debtsCount = await db
      .prepare(`SELECT COUNT(*) as count FROM debts WHERE client_id = ?`)
      .bind(clientId)
      .first();

    if (debtsCount && (debtsCount.count as number) > 0) {
      return c.json(
        { error: { code: 'HAS_DEBTS', message: 'Cannot delete client with existing debts' } },
        400
      );
    }

    // Get user_id before deleting client
    const client = await db
      .prepare(`SELECT user_id FROM clients WHERE id = ? AND tenant_id = ?`)
      .bind(clientId, tenantId)
      .first();

    if (!client) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Client not found' } },
        404
      );
    }

    // Delete client first, then user
    await db
      .prepare(`DELETE FROM clients WHERE id = ? AND tenant_id = ?`)
      .bind(clientId, tenantId)
      .run();

    await db
      .prepare(`DELETE FROM users WHERE id = ?`)
      .bind(client.user_id as string)
      .run();

    return c.json({ data: { success: true } });
  } catch (error) {
    console.error('Error deleting client:', error);
    return c.json(
      { error: { code: 'DATABASE_ERROR', message: 'Failed to delete client' } },
      500
    );
  }
});

// PUT /api/v1/clients/:id/verify - Verify client
clientRoutes.put('/:id/verify', async (c) => {
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const clientId = c.req.param('id');
  const db = c.env.DB as D1Database;

  try {
    const body = await c.req.json();
    const now = Date.now();

    await db
      .prepare(`
        UPDATE clients
        SET
          verification_status = ?,
          verification_date = ?,
          verified_by = ?,
          credibility_score = ?
        WHERE id = ? AND tenant_id = ?
      `)
      .bind(
        body.status || 'verified',
        now,
        userId,
        body.credibility_score || 50,
        clientId,
        tenantId
      )
      .run();

    const client = await db
      .prepare(`SELECT * FROM clients WHERE id = ? AND tenant_id = ?`)
      .bind(clientId, tenantId)
      .first();

    return c.json({ data: client });
  } catch (error) {
    console.error('Error verifying client:', error);
    return c.json(
      { error: { code: 'DATABASE_ERROR', message: 'Failed to verify client' } },
      500
    );
  }
});
