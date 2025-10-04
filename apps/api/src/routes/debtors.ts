import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { sendDebtNotification } from '../services/email';

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

// GET /api/v1/debtors/:id - Get single debtor
debtorRoutes.get('/:id', async (c) => {
  const tenantId = c.get('tenantId');
  const debtorId = c.req.param('id');
  const db = c.env.DB as D1Database;

  try {
    const debtor = await db
      .prepare(`SELECT * FROM debtors WHERE id = ? AND tenant_id = ?`)
      .bind(debtorId, tenantId)
      .first();

    if (!debtor) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Debtor not found' } },
        404
      );
    }

    return c.json({ data: debtor });
  } catch (error) {
    console.error('Error fetching debtor:', error);
    return c.json(
      { error: { code: 'DATABASE_ERROR', message: 'Failed to fetch debtor' } },
      500
    );
  }
});

// PUT /api/v1/debtors/:id - Update debtor
debtorRoutes.put('/:id', async (c) => {
  const tenantId = c.get('tenantId');
  const debtorId = c.req.param('id');
  const db = c.env.DB as D1Database;

  try {
    const body = await c.req.json();

    // Check if debtor exists
    const existingDebtor = await db
      .prepare(`SELECT id, type FROM debtors WHERE id = ? AND tenant_id = ?`)
      .bind(debtorId, tenantId)
      .first();

    if (!existingDebtor) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Debtor not found' } },
        404
      );
    }

    // Update debtor based on type
    if (existingDebtor.type === 'business') {
      await db
        .prepare(`
          UPDATE debtors
          SET
            company_name = ?,
            registration_number = ?,
            email = ?,
            phone = ?,
            address = ?,
            city = ?,
            postal_code = ?,
            country = ?
          WHERE id = ? AND tenant_id = ?
        `)
        .bind(
          body.company_name,
          body.registration_number || null,
          body.email || null,
          body.phone || null,
          body.address || null,
          body.city || null,
          body.postal_code || null,
          body.country || 'CZ',
          debtorId,
          tenantId
        )
        .run();
    } else {
      await db
        .prepare(`
          UPDATE debtors
          SET
            first_name = ?,
            last_name = ?,
            email = ?,
            phone = ?,
            address = ?,
            city = ?,
            postal_code = ?,
            country = ?
          WHERE id = ? AND tenant_id = ?
        `)
        .bind(
          body.first_name,
          body.last_name,
          body.email || null,
          body.phone || null,
          body.address || null,
          body.city || null,
          body.postal_code || null,
          body.country || 'CZ',
          debtorId,
          tenantId
        )
        .run();
    }

    // Fetch updated debtor
    const debtor = await db
      .prepare(`SELECT * FROM debtors WHERE id = ? AND tenant_id = ?`)
      .bind(debtorId, tenantId)
      .first();

    return c.json({ data: debtor });
  } catch (error) {
    console.error('Error updating debtor:', error);
    return c.json(
      { error: { code: 'DATABASE_ERROR', message: 'Failed to update debtor' } },
      500
    );
  }
});

// POST /api/v1/debtors/:id/notify - Send bulk notification for all verified debts of debtor
debtorRoutes.post('/:id/notify', async (c) => {
  const tenantId = c.get('tenantId');
  const debtorId = c.req.param('id');
  const db = c.env.DB as D1Database;
  const smtp2goApiKey = c.env.SMTP2GO_API_KEY;

  if (!smtp2goApiKey) {
    return c.json(
      { error: { code: 'CONFIG_ERROR', message: 'Email service not configured' } },
      500
    );
  }

  try {
    // Fetch debtor info
    const debtor = await db
      .prepare(`SELECT * FROM debtors WHERE id = ? AND tenant_id = ?`)
      .bind(debtorId, tenantId)
      .first();

    if (!debtor) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Debtor not found' } }, 404);
    }

    if (!debtor.email) {
      return c.json({ error: { code: 'NO_EMAIL', message: 'Debtor has no email address' } }, 400);
    }

    // Fetch all debts for this debtor that haven't been notified yet
    // Allow any status except draft and pending_verification
    const debts = await db
      .prepare(`
        SELECT d.*, c.company_name as client_company
        FROM debts d
        LEFT JOIN clients c ON d.client_id = c.id
        WHERE d.debtor_id = ? AND d.tenant_id = ?
        AND d.status NOT IN ('draft', 'pending_verification')
        AND (d.notification_sent IS NULL OR d.notification_sent = FALSE)
      `)
      .bind(debtorId, tenantId)
      .all();

    if (!debts.results || debts.results.length === 0) {
      return c.json({ error: { code: 'NO_DEBTS', message: 'No debts ready to notify. Debts must be verified (not draft/pending_verification status)' } }, 400);
    }

    const debtsList = debts.results;
    const now = Date.now();
    const expiresAt = now + (90 * 24 * 60 * 60 * 1000);

    // Create portal token
    const tokenId = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const token = `${debtorId}_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;

    await db
      .prepare(`INSERT INTO portal_tokens (id, tenant_id, debt_id, token, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(tokenId, tenantId, debtsList[0].id, token, now, expiresAt)
      .run();

    const portalLink = `https://lexai.pages.dev/portal/${token}`;

    // Prepare email data
    const debtorName = debtor.type === 'business'
      ? debtor.company_name
      : `${debtor.first_name} ${debtor.last_name}`;

    const emailData = {
      debtorName: debtorName as string,
      debtorEmail: debtor.email as string,
      clientName: debtsList[0].client_company as string,
      debts: debtsList.map((debt: any) => ({
        id: debt.id,
        referenceNumber: debt.reference_number || debt.id,
        debtType: debt.debt_type,
        amount: debt.original_amount,
        currency: debt.currency,
        dueDate: new Date(debt.due_date).toLocaleDateString('cs-CZ'),
        invoiceDate: new Date(debt.invoice_date).toLocaleDateString('cs-CZ'),
        description: debt.notes || '',
      })),
      portalLink,
      language: 'cs',
    };

    // Send email
    const result = await sendDebtNotification(emailData, smtp2goApiKey);

    if (!result.success) {
      return c.json({ error: { code: 'EMAIL_FAILED', message: result.error || 'Failed to send email' } }, 500);
    }

    // Update all debts
    for (const debt of debtsList) {
      await db
        .prepare(`UPDATE debts SET notification_sent = TRUE, notification_sent_at = ?, portal_token_id = ? WHERE id = ? AND tenant_id = ?`)
        .bind(now, tokenId, debt.id, tenantId)
        .run();

      const commId = `comm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db
        .prepare(`INSERT INTO communications (id, tenant_id, debt_id, type, direction, subject, content, to_email, sent_at, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(commId, tenantId, debt.id, 'email', 'outbound', `Upomínka ${debtsList.length} pohledávek`, `Bulk notification sent`, debtor.email, now, 'sent', now)
        .run();
    }

    return c.json({
      data: {
        message: `Notification sent for ${debtsList.length} debt(s)`,
        portal_link: portalLink,
        sent_to: debtor.email,
        debt_count: debtsList.length,
        token_expires_at: expiresAt,
      }
    });
  } catch (error) {
    console.error('Error sending bulk notification:', error);
    return c.json({ error: { code: 'SEND_ERROR', message: 'Failed to send notification' } }, 500);
  }
});
