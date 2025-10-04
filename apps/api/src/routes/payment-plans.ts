import { Hono } from 'hono';

export const paymentPlanRoutes = new Hono();

// POST /api/v1/payment-plans/request - Submit payment plan request (public endpoint)
paymentPlanRoutes.post('/request', async (c) => {
  const { token, monthly_amount, number_of_months, down_payment, reason } = await c.req.json();
  const db = c.env.DB as D1Database;

  try {
    // Verify portal token and get debt info
    const portalToken = await db
      .prepare(`
        SELECT
          pt.*,
          d.id as debt_id,
          d.current_amount,
          d.tenant_id,
          d.client_id,
          d.debtor_id
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

    // Validate payment plan parameters
    const totalWithoutDown = monthly_amount * number_of_months;
    const totalWithDown = totalWithoutDown + (down_payment || 0);

    if (totalWithDown < portalToken.current_amount) {
      return c.json(
        { error: { code: 'INSUFFICIENT_AMOUNT', message: 'Celková částka musí pokrýt celý dluh' } },
        400
      );
    }

    if (number_of_months > 12) {
      return c.json(
        { error: { code: 'TOO_MANY_MONTHS', message: 'Maximální počet měsíců je 12' } },
        400
      );
    }

    // Create payment plan record
    const planId = `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await db
      .prepare(`
        INSERT INTO payment_plans (
          id, tenant_id, debt_id, total_amount, down_payment,
          installment_amount, installment_count, installment_frequency,
          start_date, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        planId,
        portalToken.tenant_id,
        portalToken.debt_id,
        totalWithDown,
        down_payment || 0,
        monthly_amount,
        number_of_months,
        'monthly',
        now,
        'proposed',
        now
      )
      .run();

    // Update debt status
    await db
      .prepare(`UPDATE debts SET status = ? WHERE id = ?`)
      .bind('in_mediation', portalToken.debt_id)
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
        'Žádost o splátkový kalendář',
        `Debtor requested payment plan: ${number_of_months} monthly payments of ${monthly_amount / 100} CZK${down_payment ? ` with ${down_payment / 100} CZK down payment` : ''}. Reason: ${reason || 'Not provided'}`,
        'sent',
        now
      )
      .run();

    return c.json({
      data: {
        message: 'Žádost o splátkový kalendář byla úspěšně odeslána',
        payment_plan_id: planId,
        status: 'proposed',
      }
    });

  } catch (error) {
    console.error('Error creating payment plan request:', error);
    return c.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to submit payment plan request' } },
      500
    );
  }
});
