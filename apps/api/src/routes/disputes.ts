import { Hono } from 'hono';

export const disputeRoutes = new Hono();

// POST /api/v1/disputes/submit - Submit dispute (public endpoint)
disputeRoutes.post('/submit', async (c) => {
  const { token, dispute_type, description } = await c.req.json();
  const db = c.env.DB as D1Database;

  try {
    // Verify portal token and get debt info
    const portalToken = await db
      .prepare(`
        SELECT
          pt.*,
          d.id as debt_id,
          d.tenant_id,
          d.debtor_id,
          d.status as debt_status
        FROM portal_tokens pt
        LEFT JOIN debts d ON pt.debt_id = d.id
        WHERE pt.token = ?
      `)
      .bind(token)
      .first();

    if (!portalToken) {
      return c.json(
        { error: { code: 'INVALID_TOKEN', message: 'Invalid portal token' } },
        404
      );
    }

    // Check if token is expired
    const now = Date.now();
    if (portalToken.expires_at < now) {
      return c.json(
        { error: { code: 'EXPIRED_TOKEN', message: 'Portal link has expired' } },
        403
      );
    }

    // Check if debt is already resolved
    if (portalToken.debt_status === 'resolved_paid' || portalToken.debt_status === 'written_off') {
      return c.json(
        { error: { code: 'DEBT_RESOLVED', message: 'Nelze podat námitku k vyřešenému dluhu' } },
        400
      );
    }

    // Validate description length
    if (!description || description.length < 50) {
      return c.json(
        { error: { code: 'INVALID_DESCRIPTION', message: 'Popis musí mít alespoň 50 znaků' } },
        400
      );
    }

    // Create dispute record
    const disputeId = `dispute_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await db
      .prepare(`
        INSERT INTO disputes (
          id, tenant_id, debt_id, raised_by, dispute_type,
          description, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        disputeId,
        portalToken.tenant_id,
        portalToken.debt_id,
        'debtor',
        dispute_type,
        description,
        'open',
        now
      )
      .run();

    // Update debt status to disputed (PAUSE collection activities)
    await db
      .prepare(`UPDATE debts SET status = ? WHERE id = ?`)
      .bind('disputed', portalToken.debt_id)
      .run();

    // Create communication record
    const commId = `comm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db
      .prepare(`
        INSERT INTO communications (
          id, tenant_id, debt_id, type, direction, subject, content,
          status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        commId,
        portalToken.tenant_id,
        portalToken.debt_id,
        'portal_message',
        'inbound',
        `Námitka: ${dispute_type}`,
        `Debtor raised dispute (${dispute_type}): ${description}`,
        'sent',
        now
      )
      .run();

    return c.json({
      data: {
        message: 'Námitka byla úspěšně podána. Všechny vymáhací aktivity jsou pozastaveny.',
        dispute_id: disputeId,
        status: 'open',
      }
    });

  } catch (error) {
    console.error('Error submitting dispute:', error);
    return c.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to submit dispute' } },
      500
    );
  }
});
