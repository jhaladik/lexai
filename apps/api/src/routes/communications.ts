import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';

export const communicationRoutes = new Hono();

// All routes require authentication
communicationRoutes.use('*', requireAuth);

// GET /api/v1/communications - List all communications with filtering
communicationRoutes.get('/', async (c) => {
  const tenantId = c.get('tenantId');
  const db = c.env.DB as D1Database;

  // Query parameters for filtering
  const debtorId = c.req.query('debtor_id');
  const debtId = c.req.query('debt_id');
  const type = c.req.query('type'); // email, sms, portal_message
  const status = c.req.query('status'); // sent, pending, failed
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');

  try {
    let query = `
      SELECT
        comm.*,
        d.reference_number as debt_reference,
        dt.type as debtor_type,
        dt.first_name as debtor_first_name,
        dt.last_name as debtor_last_name,
        dt.company_name as debtor_company,
        dt.email as debtor_email,
        c.company_name as client_company
      FROM communications comm
      LEFT JOIN debts d ON comm.debt_id = d.id
      LEFT JOIN debtors dt ON d.debtor_id = dt.id
      LEFT JOIN clients c ON d.client_id = c.id
      WHERE comm.tenant_id = ?
    `;

    const params: any[] = [tenantId];

    if (debtorId) {
      query += ` AND d.debtor_id = ?`;
      params.push(debtorId);
    }

    if (debtId) {
      query += ` AND comm.debt_id = ?`;
      params.push(debtId);
    }

    if (type) {
      query += ` AND comm.type = ?`;
      params.push(type);
    }

    if (status) {
      query += ` AND comm.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY comm.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const communications = await db.prepare(query).bind(...params).all();

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM communications comm
      LEFT JOIN debts d ON comm.debt_id = d.id
      WHERE comm.tenant_id = ?
    `;
    const countParams: any[] = [tenantId];

    if (debtorId) {
      countQuery += ` AND d.debtor_id = ?`;
      countParams.push(debtorId);
    }

    if (debtId) {
      countQuery += ` AND comm.debt_id = ?`;
      countParams.push(debtId);
    }

    if (type) {
      countQuery += ` AND comm.type = ?`;
      countParams.push(type);
    }

    if (status) {
      countQuery += ` AND comm.status = ?`;
      countParams.push(status);
    }

    const totalResult = await db.prepare(countQuery).bind(...countParams).first();

    return c.json({
      data: {
        communications: communications.results || [],
        pagination: {
          total: totalResult?.total || 0,
          limit,
          offset,
        }
      }
    });

  } catch (error) {
    console.error('Error fetching communications:', error);
    return c.json(
      { error: { code: 'DATABASE_ERROR', message: 'Failed to fetch communications' } },
      500
    );
  }
});

// GET /api/v1/communications/:id - Get specific communication
communicationRoutes.get('/:id', async (c) => {
  const tenantId = c.get('tenantId');
  const commId = c.req.param('id');
  const db = c.env.DB as D1Database;

  try {
    const communication = await db
      .prepare(`
        SELECT
          comm.*,
          d.reference_number as debt_reference,
          dt.type as debtor_type,
          dt.first_name as debtor_first_name,
          dt.last_name as debtor_last_name,
          dt.company_name as debtor_company,
          dt.email as debtor_email,
          c.company_name as client_company
        FROM communications comm
        LEFT JOIN debts d ON comm.debt_id = d.id
        LEFT JOIN debtors dt ON d.debtor_id = dt.id
        LEFT JOIN clients c ON d.client_id = c.id
        WHERE comm.id = ? AND comm.tenant_id = ?
      `)
      .bind(commId, tenantId)
      .first();

    if (!communication) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Communication not found' } },
        404
      );
    }

    return c.json({ data: communication });

  } catch (error) {
    console.error('Error fetching communication:', error);
    return c.json(
      { error: { code: 'DATABASE_ERROR', message: 'Failed to fetch communication' } },
      500
    );
  }
});

// GET /api/v1/communications/debtor/:debtorId - Get communications for specific debtor
communicationRoutes.get('/debtor/:debtorId', async (c) => {
  const tenantId = c.get('tenantId');
  const debtorId = c.req.param('debtorId');
  const limit = parseInt(c.req.query('limit') || '5');
  const db = c.env.DB as D1Database;

  try {
    const communications = await db
      .prepare(`
        SELECT
          comm.*,
          d.reference_number as debt_reference
        FROM communications comm
        LEFT JOIN debts d ON comm.debt_id = d.id
        WHERE comm.tenant_id = ?
          AND d.debtor_id = ?
        ORDER BY comm.created_at DESC
        LIMIT ?
      `)
      .bind(tenantId, debtorId, limit)
      .all();

    return c.json({ data: communications.results || [] });

  } catch (error) {
    console.error('Error fetching debtor communications:', error);
    return c.json(
      { error: { code: 'DATABASE_ERROR', message: 'Failed to fetch communications' } },
      500
    );
  }
});
