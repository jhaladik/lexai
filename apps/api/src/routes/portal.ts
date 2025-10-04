import { Hono } from 'hono';

export const portalRoutes = new Hono();

// GET /api/v1/portal/:token - Public endpoint for debtor portal access
portalRoutes.get('/:token', async (c) => {
  const token = c.req.param('token');
  const db = c.env.DB as D1Database;

  try {
    // Find portal token
    const portalToken = await db
      .prepare(`
        SELECT
          pt.*,
          d.*,
          c.company_name as client_company,
          c.address as client_address,
          c.city as client_city,
          c.postal_code as client_postal_code,
          c.email as client_email,
          dt.type as debtor_type,
          dt.first_name as debtor_first_name,
          dt.last_name as debtor_last_name,
          dt.company_name as debtor_company
        FROM portal_tokens pt
        LEFT JOIN debts d ON pt.debt_id = d.id
        LEFT JOIN clients c ON d.client_id = c.id
        LEFT JOIN debtors dt ON d.debtor_id = dt.id
        WHERE pt.token = ?
      `)
      .bind(token)
      .first();

    if (!portalToken) {
      return c.json(
        { error: { code: 'INVALID_TOKEN', message: 'Invalid or expired portal link' } },
        404
      );
    }

    // Check if token is expired
    const now = Date.now();
    if (portalToken.expires_at < now) {
      return c.json(
        { error: { code: 'EXPIRED_TOKEN', message: 'This portal link has expired' } },
        403
      );
    }

    // Check if token is revoked
    if (portalToken.revoked) {
      return c.json(
        { error: { code: 'REVOKED_TOKEN', message: 'This portal link has been revoked' } },
        403
      );
    }

    // Update access tracking
    await db
      .prepare(`
        UPDATE portal_tokens
        SET last_accessed_at = ?, access_count = access_count + 1
        WHERE id = ?
      `)
      .bind(now, portalToken.id)
      .run();

    // Return debt details
    const debtorName = portalToken.debtor_type === 'business'
      ? portalToken.debtor_company
      : `${portalToken.debtor_first_name} ${portalToken.debtor_last_name}`;

    return c.json({
      data: {
        debt: {
          id: portalToken.debt_id,
          reference_number: portalToken.reference_number,
          debt_type: portalToken.debt_type,
          original_amount: portalToken.original_amount,
          current_amount: portalToken.current_amount,
          currency: portalToken.currency,
          invoice_date: portalToken.invoice_date,
          due_date: portalToken.due_date,
          status: portalToken.status,
          notes: portalToken.notes,
        },
        debtor: {
          name: debtorName,
          type: portalToken.debtor_type,
        },
        client: {
          company_name: portalToken.client_company,
          address: portalToken.client_address,
          city: portalToken.client_city,
          postal_code: portalToken.client_postal_code,
          email: portalToken.client_email,
        },
        portal_info: {
          token,
          expires_at: portalToken.expires_at,
          access_count: (portalToken.access_count as number) + 1,
        },
      }
    });

  } catch (error) {
    console.error('Error accessing portal:', error);
    return c.json(
      { error: { code: 'PORTAL_ERROR', message: 'Failed to access portal' } },
      500
    );
  }
});
