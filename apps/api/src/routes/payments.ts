import { Hono } from 'hono';
import Stripe from 'stripe';

export const paymentRoutes = new Hono();

// POST /api/v1/payments/create-intent - Create payment intent for debtor (public endpoint)
paymentRoutes.post('/create-intent', async (c) => {
  const { token, amount } = await c.req.json();
  const db = c.env.DB as D1Database;
  const stripeApiKey = c.env.STRIPE_SECRET_KEY;

  if (!stripeApiKey) {
    return c.json(
      { error: { code: 'CONFIG_ERROR', message: 'Payment service not configured' } },
      500
    );
  }

  try {
    // Verify portal token and get debt info
    const portalToken = await db
      .prepare(`
        SELECT
          pt.*,
          d.id as debt_id,
          d.current_amount,
          d.currency,
          d.reference_number,
          d.tenant_id,
          dt.type as debtor_type,
          dt.first_name as debtor_first_name,
          dt.last_name as debtor_last_name,
          dt.company_name as debtor_company,
          dt.email as debtor_email
        FROM portal_tokens pt
        LEFT JOIN debts d ON pt.debt_id = d.id
        LEFT JOIN debtors dt ON d.debtor_id = dt.id
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

    // Validate amount
    const paymentAmount = amount || portalToken.current_amount;
    if (paymentAmount <= 0 || paymentAmount > portalToken.current_amount) {
      return c.json(
        { error: { code: 'INVALID_AMOUNT', message: 'Invalid payment amount' } },
        400
      );
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeApiKey, {
      apiVersion: '2024-12-18.acacia',
    });

    // Create debtor name for receipt
    const debtorName = portalToken.debtor_type === 'business'
      ? portalToken.debtor_company
      : `${portalToken.debtor_first_name} ${portalToken.debtor_last_name}`;

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: paymentAmount, // Amount in smallest currency unit (haléře)
      currency: (portalToken.currency as string).toLowerCase(),
      description: `Payment for debt ${portalToken.reference_number || portalToken.debt_id}`,
      metadata: {
        debt_id: portalToken.debt_id as string,
        tenant_id: portalToken.tenant_id as string,
        portal_token: token,
        debtor_email: portalToken.debtor_email as string,
        debtor_name: debtorName as string,
      },
      receipt_email: portalToken.debtor_email as string,
    });

    return c.json({
      data: {
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
        amount: paymentAmount,
        currency: portalToken.currency,
      }
    });

  } catch (error) {
    console.error('Error creating payment intent:', error);
    return c.json(
      { error: { code: 'PAYMENT_ERROR', message: 'Failed to create payment intent' } },
      500
    );
  }
});

// POST /api/v1/payments/webhook - Stripe webhook handler
paymentRoutes.post('/webhook', async (c) => {
  const stripeApiKey = c.env.STRIPE_SECRET_KEY;
  const webhookSecret = c.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeApiKey || !webhookSecret) {
    return c.json(
      { error: { code: 'CONFIG_ERROR', message: 'Payment service not configured' } },
      500
    );
  }

  try {
    const stripe = new Stripe(stripeApiKey, {
      apiVersion: '2024-12-18.acacia',
    });

    const signature = c.req.header('stripe-signature');
    if (!signature) {
      return c.json(
        { error: { code: 'INVALID_SIGNATURE', message: 'Missing signature' } },
        400
      );
    }

    const body = await c.req.text();
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);

    const db = c.env.DB as D1Database;

    // Handle payment intent succeeded
    if (event.type === 'payment_intent.succeeded') {
      let paymentIntent = event.data.object as Stripe.PaymentIntent;

      console.log('Payment webhook received:', {
        payment_id: paymentIntent.id,
        amount: paymentIntent.amount,
        has_metadata: !!paymentIntent.metadata,
      });

      // If metadata is missing in webhook, fetch the full payment intent
      if (!paymentIntent.metadata || !paymentIntent.metadata.debt_id) {
        console.log('Metadata missing in webhook, fetching payment intent from Stripe...');
        const stripe = new Stripe(stripeApiKey, {
          apiVersion: '2024-12-18.acacia',
        });
        paymentIntent = await stripe.paymentIntents.retrieve(paymentIntent.id);
        console.log('Fetched payment intent metadata:', paymentIntent.metadata);
      }

      const metadata = paymentIntent.metadata;

      // Check if metadata exists
      if (!metadata || !metadata.debt_id) {
        console.error('No metadata found even after fetching:', paymentIntent.id);
        return c.json({ received: true, error: 'No metadata' });
      }

      // Create payment record
      const paymentId = `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = Date.now();

      await db
        .prepare(`
          INSERT INTO payments (
            id, tenant_id, debt_id, amount, currency, payment_method,
            processor, processor_payment_id, processor_status,
            status, paid_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          paymentId,
          metadata.tenant_id,
          metadata.debt_id,
          paymentIntent.amount,
          paymentIntent.currency.toUpperCase(),
          'card',
          'stripe',
          paymentIntent.id,
          paymentIntent.status,
          'succeeded',
          now,
          now
        )
        .run();

      // Update debt
      const debt = await db
        .prepare(`SELECT current_amount, total_paid FROM debts WHERE id = ?`)
        .bind(metadata.debt_id)
        .first();

      if (debt) {
        const newTotalPaid = (debt.total_paid as number || 0) + paymentIntent.amount;
        const newCurrentAmount = (debt.current_amount as number) - paymentIntent.amount;
        const newStatus = newCurrentAmount <= 0 ? 'resolved_paid' : debt.status;

        await db
          .prepare(`
            UPDATE debts
            SET total_paid = ?, current_amount = ?, last_payment_date = ?, status = ?
            WHERE id = ?
          `)
          .bind(newTotalPaid, Math.max(0, newCurrentAmount), now, newStatus, metadata.debt_id)
          .run();

        // Create communication record
        const commId = `comm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await db
          .prepare(`
            INSERT INTO communications (
              id, tenant_id, debt_id, type, direction, subject, content,
              to_email, sent_at, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            commId,
            metadata.tenant_id,
            metadata.debt_id,
            'email',
            'outbound',
            'Platba přijata',
            `Payment of ${paymentIntent.amount / 100} ${paymentIntent.currency.toUpperCase()} received via Stripe`,
            metadata.debtor_email,
            now,
            'sent',
            now
          )
          .run();
      }
    }

    return c.json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return c.json(
      { error: { code: 'WEBHOOK_ERROR', message: 'Failed to process webhook' } },
      400
    );
  }
});

// GET /api/v1/payments/status/:token - Check payment status for debt (public endpoint)
paymentRoutes.get('/status/:token', async (c) => {
  const token = c.req.param('token');
  const db = c.env.DB as D1Database;

  try {
    // Get debt info from portal token
    const portalToken = await db
      .prepare(`
        SELECT
          d.id as debt_id,
          d.current_amount,
          d.original_amount,
          d.total_paid,
          d.status,
          d.last_payment_date
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

    // Get recent payments
    const payments = await db
      .prepare(`
        SELECT id, amount, currency, payment_method, status, paid_at
        FROM payments
        WHERE debt_id = ?
        ORDER BY paid_at DESC
        LIMIT 10
      `)
      .bind(portalToken.debt_id)
      .all();

    return c.json({
      data: {
        debt_status: portalToken.status,
        original_amount: portalToken.original_amount,
        current_amount: portalToken.current_amount,
        total_paid: portalToken.total_paid,
        last_payment_date: portalToken.last_payment_date,
        recent_payments: payments.results || [],
      }
    });

  } catch (error) {
    console.error('Error fetching payment status:', error);
    return c.json(
      { error: { code: 'DATABASE_ERROR', message: 'Failed to fetch payment status' } },
      500
    );
  }
});
