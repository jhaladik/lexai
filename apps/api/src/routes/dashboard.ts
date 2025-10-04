import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';

const dashboard = new Hono();

// GET /api/v1/dashboard - Get dashboard statistics
dashboard.get('/', requireAuth, async (c) => {
  const tenantId = c.get('tenantId');
  const db = c.env.DB as D1Database;

  try {
    // Get total debts count and value
    const totalStats = await db
      .prepare(
        `SELECT
          COUNT(*) as total_debts,
          SUM(original_amount) as total_value,
          SUM(total_paid) as total_collected
        FROM debts
        WHERE tenant_id = ?`
      )
      .bind(tenantId)
      .first();

    // Get active debts count
    const activeStats = await db
      .prepare(
        `SELECT COUNT(*) as active_debts
        FROM debts
        WHERE tenant_id = ?
        AND status NOT IN ('resolved_paid', 'resolved_partial', 'written_off')`
      )
      .bind(tenantId)
      .first();

    // Get recent debts
    const recentDebts = await db
      .prepare(
        `SELECT
          d.id,
          d.reference_number,
          d.original_amount,
          d.status,
          d.created_at,
          dt.type as debtor_type,
          dt.first_name,
          dt.last_name,
          dt.company_name
        FROM debts d
        JOIN debtors dt ON d.debtor_id = dt.id
        WHERE d.tenant_id = ?
        ORDER BY d.created_at DESC
        LIMIT 10`
      )
      .bind(tenantId)
      .all();

    return c.json({
      data: {
        stats: {
          total_debts: totalStats?.total_debts || 0,
          active_debts: activeStats?.active_debts || 0,
          total_value: totalStats?.total_value || 0,
          total_collected: totalStats?.total_collected || 0,
        },
        recent_debts: recentDebts.results || [],
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return c.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch dashboard data',
        },
      },
      500
    );
  }
});

export { dashboard as dashboardRoutes };
