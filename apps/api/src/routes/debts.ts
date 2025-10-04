import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';

export const debtRoutes = new Hono();

// All routes require authentication
debtRoutes.use('*', requireAuth);

// GET /api/v1/debts - List all debts
debtRoutes.get('/', async (c) => {
  const tenantId = c.get('tenantId');
  const userRole = c.get('userRole');
  const userId = c.get('userId');
  const db = c.env.DB as D1Database;

  try {
    // Build query based on role
    let query = `
      SELECT
        d.*,
        c.company_name as client_company,
        dt.type as debtor_type,
        dt.first_name as debtor_first_name,
        dt.last_name as debtor_last_name,
        dt.company_name as debtor_company
      FROM debts d
      LEFT JOIN clients c ON d.client_id = c.id
      LEFT JOIN debtors dt ON d.debtor_id = dt.id
      WHERE d.tenant_id = ?
    `;

    // If client role, only show their debts
    if (userRole === 'client') {
      const client = await db
        .prepare(`SELECT id FROM clients WHERE user_id = ? AND tenant_id = ?`)
        .bind(userId, tenantId)
        .first();

      if (client) {
        query += ` AND d.client_id = '${client.id}'`;
      }
    }

    query += ` ORDER BY d.created_at DESC`;

    const result = await db.prepare(query).bind(tenantId).all();

    return c.json({ data: result.results || [] });
  } catch (error) {
    console.error('Error listing debts:', error);
    return c.json(
      { error: { code: 'DATABASE_ERROR', message: 'Failed to fetch debts' } },
      500
    );
  }
});

// POST /api/v1/debts - Create new debt
debtRoutes.post('/', async (c) => {
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const db = c.env.DB as D1Database;

  try {
    const body = await c.req.json();

    // Generate IDs
    const debtId = `debt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    // Validate required fields
    if (!body.client_id || !body.debtor_id || !body.debt_type || !body.original_amount) {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } },
        400
      );
    }

    // Create debtor if needed (new debtor data provided)
    let debtorId = body.debtor_id;
    if (body.debtor_id === 'new' && body.debtor) {
      debtorId = `debtor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await db
        .prepare(`
          INSERT INTO debtors (
            id, tenant_id, type, first_name, last_name, company_name,
            registration_number, email, phone, address, city, postal_code,
            country, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          debtorId,
          tenantId,
          body.debtor.type,
          body.debtor.first_name || null,
          body.debtor.last_name || null,
          body.debtor.company_name || null,
          body.debtor.registration_number || null,
          body.debtor.email || null,
          body.debtor.phone || null,
          body.debtor.address || null,
          body.debtor.city || null,
          body.debtor.postal_code || null,
          body.debtor.country || 'CZ',
          now
        )
        .run();
    }

    // Create debt
    await db
      .prepare(`
        INSERT INTO debts (
          id, tenant_id, client_id, debtor_id, reference_number, debt_type,
          original_amount, current_amount, currency, invoice_date, due_date,
          status, verification_status, has_contract, has_invoice,
          has_delivery_proof, has_communication_log, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        debtId,
        tenantId,
        body.client_id,
        debtorId,
        body.reference_number || null,
        body.debt_type,
        body.original_amount,
        body.original_amount, // current_amount starts same as original
        body.currency || 'CZK',
        body.invoice_date ? new Date(body.invoice_date).getTime() : now,
        body.due_date ? new Date(body.due_date).getTime() : now,
        'draft',
        'pending',
        body.has_contract || false,
        body.has_invoice || false,
        body.has_delivery_proof || false,
        body.has_communication_log || false,
        body.notes || null,
        now
      )
      .run();

    // Fetch the created debt with joined data
    const debt = await db
      .prepare(`
        SELECT
          d.*,
          c.company_name as client_company,
          dt.type as debtor_type,
          dt.first_name as debtor_first_name,
          dt.last_name as debtor_last_name,
          dt.company_name as debtor_company
        FROM debts d
        LEFT JOIN clients c ON d.client_id = c.id
        LEFT JOIN debtors dt ON d.debtor_id = dt.id
        WHERE d.id = ?
      `)
      .bind(debtId)
      .first();

    return c.json({ data: debt }, 201);
  } catch (error) {
    console.error('Error creating debt:', error);
    return c.json(
      { error: { code: 'DATABASE_ERROR', message: 'Failed to create debt' } },
      500
    );
  }
});

// GET /api/v1/debts/:id - Get single debt
debtRoutes.get('/:id', async (c) => {
  const tenantId = c.get('tenantId');
  const debtId = c.req.param('id');
  const db = c.env.DB as D1Database;

  try {
    const debt = await db
      .prepare(`
        SELECT
          d.*,
          c.company_name as client_company,
          c.registration_number as client_ico,
          dt.*,
          dt.type as debtor_type,
          dt.first_name as debtor_first_name,
          dt.last_name as debtor_last_name,
          dt.company_name as debtor_company
        FROM debts d
        LEFT JOIN clients c ON d.client_id = c.id
        LEFT JOIN debtors dt ON d.debtor_id = dt.id
        WHERE d.id = ? AND d.tenant_id = ?
      `)
      .bind(debtId, tenantId)
      .first();

    if (!debt) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Debt not found' } },
        404
      );
    }

    return c.json({ data: debt });
  } catch (error) {
    console.error('Error fetching debt:', error);
    return c.json(
      { error: { code: 'DATABASE_ERROR', message: 'Failed to fetch debt' } },
      500
    );
  }
});

// PUT /api/v1/debts/:id - Update debt
debtRoutes.put('/:id', async (c) => {
  const tenantId = c.get('tenantId');
  const debtId = c.req.param('id');
  const db = c.env.DB as D1Database;

  try {
    const body = await c.req.json();

    // Check if debt exists and can be edited
    const existingDebt = await db
      .prepare(`SELECT status FROM debts WHERE id = ? AND tenant_id = ?`)
      .bind(debtId, tenantId)
      .first();

    if (!existingDebt) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Debt not found' } },
        404
      );
    }

    // Only allow editing if status is draft or pending_verification
    const editableStatuses = ['draft', 'pending_verification'];
    if (!editableStatuses.includes(existingDebt.status as string)) {
      return c.json(
        { error: { code: 'CANNOT_EDIT', message: 'Cannot edit debt with active process' } },
        400
      );
    }

    // Update debt
    await db
      .prepare(`
        UPDATE debts
        SET
          reference_number = ?,
          debt_type = ?,
          original_amount = ?,
          current_amount = ?,
          currency = ?,
          invoice_date = ?,
          due_date = ?,
          has_contract = ?,
          has_invoice = ?,
          has_delivery_proof = ?,
          has_communication_log = ?,
          notes = ?
        WHERE id = ? AND tenant_id = ?
      `)
      .bind(
        body.reference_number || null,
        body.debt_type,
        body.original_amount,
        body.original_amount, // current_amount matches original when editing
        body.currency || 'CZK',
        body.invoice_date ? new Date(body.invoice_date).getTime() : null,
        body.due_date ? new Date(body.due_date).getTime() : null,
        body.has_contract || false,
        body.has_invoice || false,
        body.has_delivery_proof || false,
        body.has_communication_log || false,
        body.notes || null,
        debtId,
        tenantId
      )
      .run();

    // Fetch updated debt
    const debt = await db
      .prepare(`
        SELECT
          d.*,
          c.company_name as client_company,
          dt.type as debtor_type,
          dt.first_name as debtor_first_name,
          dt.last_name as debtor_last_name,
          dt.company_name as debtor_company
        FROM debts d
        LEFT JOIN clients c ON d.client_id = c.id
        LEFT JOIN debtors dt ON d.debtor_id = dt.id
        WHERE d.id = ? AND d.tenant_id = ?
      `)
      .bind(debtId, tenantId)
      .first();

    return c.json({ data: debt });
  } catch (error) {
    console.error('Error updating debt:', error);
    return c.json(
      { error: { code: 'DATABASE_ERROR', message: 'Failed to update debt' } },
      500
    );
  }
});

// DELETE /api/v1/debts/:id - Delete debt
debtRoutes.delete('/:id', async (c) => {
  const tenantId = c.get('tenantId');
  const debtId = c.req.param('id');
  const db = c.env.DB as D1Database;

  try {
    // Check if debt exists and can be deleted
    const debt = await db
      .prepare(`SELECT status FROM debts WHERE id = ? AND tenant_id = ?`)
      .bind(debtId, tenantId)
      .first();

    if (!debt) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Debt not found' } },
        404
      );
    }

    // Only allow deletion if status is draft or pending_verification
    const deletableStatuses = ['draft', 'pending_verification'];
    if (!deletableStatuses.includes(debt.status as string)) {
      return c.json(
        { error: { code: 'CANNOT_DELETE', message: 'Cannot delete debt with active process' } },
        400
      );
    }

    // Delete debt
    await db
      .prepare(`DELETE FROM debts WHERE id = ? AND tenant_id = ?`)
      .bind(debtId, tenantId)
      .run();

    return c.json({ data: { success: true } });
  } catch (error) {
    console.error('Error deleting debt:', error);
    return c.json(
      { error: { code: 'DATABASE_ERROR', message: 'Failed to delete debt' } },
      500
    );
  }
});

// POST /api/v1/debts/bulk-upload
debtRoutes.post('/bulk-upload', async (c) => {
  return c.json({ message: 'Bulk upload debts - to be implemented' });
});

// GET /api/v1/debts/bulk-template
debtRoutes.get('/bulk-template', async (c) => {
  return c.json({ message: 'Download bulk template - to be implemented' });
});
