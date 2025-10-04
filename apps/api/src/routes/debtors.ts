import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';

export const debtorRoutes = new Hono();

// All routes require authentication
debtorRoutes.use('*', requireAuth);

// GET /api/v1/debtors - List all debtors
debtorRoutes.get('/', async (c) => {
  const tenantId = c.get('tenantId');
  const db = c.env.DB as D1Database;

  try {
    const result = await db
      .prepare(`
        SELECT
          id,
          type,
          first_name,
          last_name,
          company_name,
          registration_number,
          email,
          phone,
          city
        FROM debtors
        WHERE tenant_id = ?
        ORDER BY created_at DESC
      `)
      .bind(tenantId)
      .all();

    return c.json({ data: result.results || [] });
  } catch (error) {
    console.error('Error listing debtors:', error);
    return c.json(
      { error: { code: 'DATABASE_ERROR', message: 'Failed to fetch debtors' } },
      500
    );
  }
});
