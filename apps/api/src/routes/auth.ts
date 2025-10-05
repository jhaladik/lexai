import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';

export const authRoutes = new Hono();

// GET /api/v1/auth/me - Get current user info
authRoutes.get('/me', requireAuth, async (c) => {
  const userId = c.get('userId');
  const tenantId = c.get('tenantId');
  const userEmail = c.get('userEmail');
  const userRole = c.get('userRole');

  // Get full user details from database
  const db = c.env.DB as D1Database;
  const user = await db
    .prepare(`
      SELECT
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.role,
        u.tenant_id
      FROM users u
      WHERE u.id = ?
    `)
    .bind(userId)
    .first();

  if (!user) {
    return c.json(
      {
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      },
      404
    );
  }

  return c.json({
    data: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      tenant_id: user.tenant_id,
    },
  });
});
