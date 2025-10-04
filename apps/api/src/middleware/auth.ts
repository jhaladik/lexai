import { Context, Next } from 'hono';
import { createMiddleware } from 'hono/factory';

// Cloudflare Access JWT validation
// https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/

interface CloudflareAccessPayload {
  aud: string[];
  email: string;
  type: string;
  iat: number;
  exp: number;
  common_name?: string;
  custom?: Record<string, unknown>;
}

interface AuthVariables {
  userId: string;
  tenantId: string;
  userEmail: string;
  userRole: string;
}

/**
 * Validates Cloudflare Access JWT token
 * Extracts user info and attaches to context
 */
export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(
  async (c: Context, next: Next) => {
    // Get the CF-Access-JWT-Assertion header (Cloudflare Access JWT)
    const token = c.req.header('CF-Access-JWT-Assertion');

    if (!token) {
      return c.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'No authentication token provided',
          },
        },
        401
      );
    }

    try {
      // In production, you should validate the JWT signature against Cloudflare's public keys
      // For now, we'll decode and verify basic structure

      // Decode JWT (base64 decode the payload)
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      const payload = JSON.parse(atob(parts[1])) as CloudflareAccessPayload;

      // Verify token hasn't expired
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        return c.json(
          {
            error: {
              code: 'TOKEN_EXPIRED',
              message: 'Authentication token has expired',
            },
          },
          401
        );
      }

      // Get user email from token
      const email = payload.email;
      if (!email) {
        throw new Error('No email in token');
      }

      // Look up user in database
      const db = c.env.DB as D1Database;
      const user = await db
        .prepare('SELECT id, tenant_id, role FROM users WHERE email = ? AND status = ?')
        .bind(email, 'active')
        .first();

      if (!user) {
        return c.json(
          {
            error: {
              code: 'USER_NOT_FOUND',
              message: 'User not found or inactive',
            },
          },
          403
        );
      }

      // Attach user info to context
      c.set('userId', user.id as string);
      c.set('tenantId', user.tenant_id as string);
      c.set('userEmail', email);
      c.set('userRole', user.role as string);

      await next();
    } catch (error) {
      console.error('Auth error:', error);
      return c.json(
        {
          error: {
            code: 'AUTH_FAILED',
            message: 'Authentication failed',
          },
        },
        401
      );
    }
  }
);

/**
 * Optional auth - allows both authenticated and unauthenticated requests
 * Useful for public endpoints that have different behavior when authenticated
 */
export const optionalAuth = createMiddleware<{ Variables: AuthVariables }>(
  async (c: Context, next: Next) => {
    const token = c.req.header('CF-Access-JWT-Assertion');

    if (token) {
      try {
        const parts = token.split('.');
        const payload = JSON.parse(atob(parts[1])) as CloudflareAccessPayload;
        const email = payload.email;

        if (email) {
          const db = c.env.DB as D1Database;
          const user = await db
            .prepare('SELECT id, tenant_id, role FROM users WHERE email = ? AND status = ?')
            .bind(email, 'active')
            .first();

          if (user) {
            c.set('userId', user.id as string);
            c.set('tenantId', user.tenant_id as string);
            c.set('userEmail', email);
            c.set('userRole', user.role as string);
          }
        }
      } catch (error) {
        // Silently fail for optional auth
        console.warn('Optional auth failed:', error);
      }
    }

    await next();
  }
);

/**
 * Require specific role(s)
 */
export const requireRole = (...allowedRoles: string[]) => {
  return createMiddleware(async (c: Context, next: Next) => {
    const userRole = c.get('userRole');

    if (!userRole || !allowedRoles.includes(userRole)) {
      return c.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions',
          },
        },
        403
      );
    }

    await next();
  });
};
