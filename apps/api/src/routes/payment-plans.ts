import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';

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

// GET /api/v1/payment-plans - List all payment plans for client
paymentPlanRoutes.get('/', requireAuth, async (c) => {
  const tenantId = c.get('tenantId');
  const db = c.env.DB as D1Database;

  try {
    const plans = await db
      .prepare(`
        SELECT
          pp.*,
          d.reference_number,
          d.original_amount as debt_amount,
          dt.type as debtor_type,
          dt.first_name as debtor_first_name,
          dt.last_name as debtor_last_name,
          dt.company_name as debtor_company,
          c.company_name as client_company
        FROM payment_plans pp
        LEFT JOIN debts d ON pp.debt_id = d.id
        LEFT JOIN debtors dt ON d.debtor_id = dt.id
        LEFT JOIN clients c ON d.client_id = c.id
        WHERE pp.tenant_id = ?
        ORDER BY pp.created_at DESC
      `)
      .bind(tenantId)
      .all();

    return c.json({ data: plans.results || [] });
  } catch (error) {
    console.error('Error fetching payment plans:', error);
    return c.json(
      { error: { code: 'DATABASE_ERROR', message: 'Failed to fetch payment plans' } },
      500
    );
  }
});

// GET /api/v1/payment-plans/:id - Get specific payment plan with installments
paymentPlanRoutes.get('/:id', requireAuth, async (c) => {
  const tenantId = c.get('tenantId');
  const planId = c.req.param('id');
  const db = c.env.DB as D1Database;

  try {
    const plan = await db
      .prepare(`
        SELECT
          pp.*,
          d.reference_number,
          d.original_amount as debt_amount,
          dt.type as debtor_type,
          dt.first_name as debtor_first_name,
          dt.last_name as debtor_last_name,
          dt.company_name as debtor_company,
          dt.email as debtor_email,
          c.company_name as client_company
        FROM payment_plans pp
        LEFT JOIN debts d ON pp.debt_id = d.id
        LEFT JOIN debtors dt ON d.debtor_id = dt.id
        LEFT JOIN clients c ON d.client_id = c.id
        WHERE pp.id = ? AND pp.tenant_id = ?
      `)
      .bind(planId, tenantId)
      .first();

    if (!plan) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Payment plan not found' } },
        404
      );
    }

    // Get installments
    const installments = await db
      .prepare(`
        SELECT * FROM installments
        WHERE payment_plan_id = ?
        ORDER BY installment_number ASC
      `)
      .bind(planId)
      .all();

    return c.json({
      data: {
        ...plan,
        installments: installments.results || []
      }
    });
  } catch (error) {
    console.error('Error fetching payment plan:', error);
    return c.json(
      { error: { code: 'DATABASE_ERROR', message: 'Failed to fetch payment plan' } },
      500
    );
  }
});

// PUT /api/v1/payment-plans/:id/approve - Client approves payment plan
paymentPlanRoutes.put('/:id/approve', requireAuth, async (c) => {
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const planId = c.req.param('id');
  const db = c.env.DB as D1Database;

  try {
    const now = Date.now();

    // Get plan details
    const plan = await db
      .prepare(`
        SELECT pp.*, d.debtor_id, d.client_id
        FROM payment_plans pp
        LEFT JOIN debts d ON pp.debt_id = d.id
        WHERE pp.id = ? AND pp.tenant_id = ?
      `)
      .bind(planId, tenantId)
      .first();

    if (!plan) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Payment plan not found' } },
        404
      );
    }

    if (plan.status !== 'proposed') {
      return c.json(
        { error: { code: 'INVALID_STATUS', message: 'Can only approve proposed payment plans' } },
        400
      );
    }

    // Update payment plan to active
    await db
      .prepare(`
        UPDATE payment_plans
        SET status = 'active',
            agreed_by_client = TRUE,
            agreement_date = ?
        WHERE id = ?
      `)
      .bind(now, planId)
      .run();

    // Generate installment records
    const installmentFrequencyMs = plan.installment_frequency === 'weekly' ? 7 * 24 * 60 * 60 * 1000 :
                                    plan.installment_frequency === 'biweekly' ? 14 * 24 * 60 * 60 * 1000 :
                                    30 * 24 * 60 * 60 * 1000; // monthly

    let installmentDate = plan.start_date;

    for (let i = 1; i <= plan.installment_count; i++) {
      installmentDate += installmentFrequencyMs;
      const installmentId = `inst_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`;

      await db
        .prepare(`
          INSERT INTO installments (
            id, tenant_id, payment_plan_id, installment_number,
            amount, due_date, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          installmentId,
          tenantId,
          planId,
          i,
          plan.installment_amount,
          installmentDate,
          'pending'
        )
        .run();
    }

    // Update debt status
    await db
      .prepare(`UPDATE debts SET status = 'payment_plan_active' WHERE id = ?`)
      .bind(plan.debt_id)
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
        tenantId,
        plan.debt_id,
        'portal_message',
        'outbound',
        'Schválení splatkového kalendáře',
        `Payment plan approved by client. ${plan.installment_count} installments of ${plan.installment_amount / 100} CZK.`,
        'sent',
        now
      )
      .run();

    return c.json({
      data: {
        message: 'Payment plan approved successfully',
        payment_plan_id: planId,
        status: 'active',
        installments_created: plan.installment_count
      }
    });

  } catch (error) {
    console.error('Error approving payment plan:', error);
    return c.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to approve payment plan' } },
      500
    );
  }
});

// PUT /api/v1/payment-plans/:id/reject - Client rejects payment plan
paymentPlanRoutes.put('/:id/reject', requireAuth, async (c) => {
  const tenantId = c.get('tenantId');
  const planId = c.req.param('id');
  const { reason } = await c.req.json();
  const db = c.env.DB as D1Database;

  try {
    const now = Date.now();

    const plan = await db
      .prepare(`
        SELECT pp.*, d.debtor_id
        FROM payment_plans pp
        LEFT JOIN debts d ON pp.debt_id = d.id
        WHERE pp.id = ? AND pp.tenant_id = ?
      `)
      .bind(planId, tenantId)
      .first();

    if (!plan) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Payment plan not found' } },
        404
      );
    }

    // Update plan to cancelled
    await db
      .prepare(`UPDATE payment_plans SET status = 'cancelled' WHERE id = ?`)
      .bind(planId)
      .run();

    // Reset debt status
    await db
      .prepare(`UPDATE debts SET status = 'pending_verification' WHERE id = ?`)
      .bind(plan.debt_id)
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
        tenantId,
        plan.debt_id,
        'portal_message',
        'outbound',
        'Zamítnutí splatkového kalendáře',
        `Payment plan rejected by client. Reason: ${reason || 'Not provided'}`,
        'sent',
        now
      )
      .run();

    return c.json({
      data: {
        message: 'Payment plan rejected',
        payment_plan_id: planId,
        status: 'cancelled'
      }
    });

  } catch (error) {
    console.error('Error rejecting payment plan:', error);
    return c.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to reject payment plan' } },
      500
    );
  }
});

// POST /api/v1/payment-plans/installments/:id/charge - Attempt automatic charge
paymentPlanRoutes.post('/installments/:id/charge', async (c) => {
  const installmentId = c.req.param('id');
  const db = c.env.DB as D1Database;

  try {
    // Get installment details
    const installment = await db
      .prepare(`
        SELECT
          i.*,
          pp.debt_id,
          pp.tenant_id,
          d.debtor_id,
          dt.email as debtor_email
        FROM installments i
        LEFT JOIN payment_plans pp ON i.payment_plan_id = pp.id
        LEFT JOIN debts d ON pp.debt_id = d.id
        LEFT JOIN debtors dt ON d.debtor_id = dt.id
        WHERE i.id = ?
      `)
      .bind(installmentId)
      .first();

    if (!installment) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Installment not found' } },
        404
      );
    }

    if (installment.paid) {
      return c.json(
        { error: { code: 'ALREADY_PAID', message: 'Installment already paid' } },
        400
      );
    }

    // TODO: Implement Stripe auto-charge when card on file exists
    // For now, we'll just mark this as a manual payment tracking system

    return c.json({
      data: {
        message: 'Automatic charge functionality requires Stripe card on file',
        installment_id: installmentId,
        status: 'pending_manual_payment'
      }
    });

  } catch (error) {
    console.error('Error charging installment:', error);
    return c.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to charge installment' } },
      500
    );
  }
});

// POST /api/v1/payment-plans/installments/:id/record-payment - Record manual payment
paymentPlanRoutes.post('/installments/:id/record-payment', requireAuth, async (c) => {
  const installmentId = c.req.param('id');
  const { amount, payment_method, notes } = await c.req.json();
  const db = c.env.DB as D1Database;
  const tenantId = c.get('tenantId');

  try {
    const now = Date.now();

    // Get installment details
    const installment = await db
      .prepare(`
        SELECT
          i.*,
          pp.debt_id,
          pp.installment_count,
          d.current_amount as debt_current_amount,
          d.total_paid as debt_total_paid
        FROM installments i
        LEFT JOIN payment_plans pp ON i.payment_plan_id = pp.id
        LEFT JOIN debts d ON pp.debt_id = d.id
        WHERE i.id = ? AND i.tenant_id = ?
      `)
      .bind(installmentId, tenantId)
      .first();

    if (!installment) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Installment not found' } },
        404
      );
    }

    // Update installment
    const fullyPaid = amount >= installment.amount;
    await db
      .prepare(`
        UPDATE installments
        SET paid = ?, paid_amount = ?, paid_date = ?, status = ?
        WHERE id = ?
      `)
      .bind(
        fullyPaid,
        amount,
        now,
        fullyPaid ? 'paid' : 'partial',
        installmentId
      )
      .run();

    // Update debt totals
    await db
      .prepare(`
        UPDATE debts
        SET total_paid = total_paid + ?,
            current_amount = current_amount - ?,
            last_payment_date = ?
        WHERE id = ?
      `)
      .bind(amount, amount, now, installment.debt_id)
      .run();

    // Check if all installments are paid
    const unpaidCount = await db
      .prepare(`
        SELECT COUNT(*) as count FROM installments
        WHERE payment_plan_id = ? AND paid = FALSE
      `)
      .bind(installment.payment_plan_id)
      .first();

    if (unpaidCount.count === 0) {
      // Mark payment plan as completed
      await db
        .prepare(`UPDATE payment_plans SET status = 'completed' WHERE id = ?`)
        .bind(installment.payment_plan_id)
        .run();

      // Check if debt is fully paid
      const updatedDebt = await db
        .prepare(`SELECT current_amount FROM debts WHERE id = ?`)
        .bind(installment.debt_id)
        .first();

      if (updatedDebt.current_amount <= 0) {
        await db
          .prepare(`UPDATE debts SET status = 'resolved_paid' WHERE id = ?`)
          .bind(installment.debt_id)
          .run();
      }
    }

    // Create payment record
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db
      .prepare(`
        INSERT INTO payments (
          id, tenant_id, debt_id, installment_id, amount,
          payment_method, processor, status, paid_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        paymentId,
        tenantId,
        installment.debt_id,
        installmentId,
        amount,
        payment_method || 'manual',
        'manual',
        'succeeded',
        now,
        now
      )
      .run();

    return c.json({
      data: {
        message: 'Payment recorded successfully',
        installment_id: installmentId,
        payment_id: paymentId,
        amount_paid: amount,
        fully_paid: fullyPaid
      }
    });

  } catch (error) {
    console.error('Error recording payment:', error);
    return c.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to record payment' } },
      500
    );
  }
});

// PUT /api/v1/payment-plans/:id/accelerate - Trigger acceleration after default
paymentPlanRoutes.put('/:id/accelerate', async (c) => {
  const planId = c.req.param('id');
  const db = c.env.DB as D1Database;

  try {
    const now = Date.now();

    const plan = await db
      .prepare(`
        SELECT pp.*, d.current_amount, d.tenant_id
        FROM payment_plans pp
        LEFT JOIN debts d ON pp.debt_id = d.id
        WHERE pp.id = ?
      `)
      .bind(planId)
      .first();

    if (!plan) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Payment plan not found' } },
        404
      );
    }

    // Update payment plan to defaulted
    await db
      .prepare(`
        UPDATE payment_plans
        SET status = 'defaulted', default_date = ?
        WHERE id = ?
      `)
      .bind(now, planId)
      .run();

    // Update debt status
    await db
      .prepare(`
        UPDATE debts
        SET status = 'payment_plan_defaulted'
        WHERE id = ?
      `)
      .bind(plan.debt_id)
      .run();

    // Mark all unpaid installments as waived
    await db
      .prepare(`
        UPDATE installments
        SET status = 'waived'
        WHERE payment_plan_id = ? AND paid = FALSE
      `)
      .bind(planId)
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
        plan.tenant_id,
        plan.debt_id,
        'email',
        'outbound',
        'Acceleration of Payment Plan',
        `Payment plan has been accelerated due to missed payment. Full balance of ${plan.current_amount / 100} CZK is now due immediately.`,
        'pending',
        now
      )
      .run();

    return c.json({
      data: {
        message: 'Payment plan accelerated',
        payment_plan_id: planId,
        remaining_balance: plan.current_amount,
        status: 'defaulted'
      }
    });

  } catch (error) {
    console.error('Error accelerating payment plan:', error);
    return c.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to accelerate payment plan' } },
      500
    );
  }
});
