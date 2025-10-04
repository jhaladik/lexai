import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { sendDebtNotification } from '../services/email';

export const debtorNotificationRoutes = new Hono();

// All routes require authentication
debtorNotificationRoutes.use('*', requireAuth);

// POST /api/v1/debtors/:debtorId/notify - Send notification for all verified debts of a debtor
debtorNotificationRoutes.post('/:debtorId/notify', async (c) => {
  const tenantId = c.get('tenantId');
  const debtorId = c.req.param('debtorId');
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
      .prepare(`
        SELECT *
        FROM debtors
        WHERE id = ? AND tenant_id = ?
      `)
      .bind(debtorId, tenantId)
      .first();

    if (!debtor) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Debtor not found' } },
        404
      );
    }

    if (!debtor.email) {
      return c.json(
        { error: { code: 'NO_EMAIL', message: 'Debtor has no email address' } },
        400
      );
    }

    // Fetch all verified debts for this debtor that haven't been notified
    const debts = await db
      .prepare(`
        SELECT
          d.*,
          c.company_name as client_company
        FROM debts d
        LEFT JOIN clients c ON d.client_id = c.id
        WHERE d.debtor_id = ? AND d.tenant_id = ?
        AND d.status = 'verified'
        AND (d.notification_sent IS NULL OR d.notification_sent = FALSE)
      `)
      .bind(debtorId, tenantId)
      .all();

    if (!debts.results || debts.results.length === 0) {
      return c.json(
        { error: { code: 'NO_DEBTS', message: 'No verified debts to notify for this debtor' } },
        400
      );
    }

    const debtsList = debts.results;
    const now = Date.now();
    const expiresAt = now + (90 * 24 * 60 * 60 * 1000); // 90 days

    // Create portal token for first debt (debtor portal will show all their debts)
    const tokenId = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const token = `${debtorId}_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;

    await db
      .prepare(`
        INSERT INTO portal_tokens (
          id, tenant_id, debt_id, token, created_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(tokenId, tenantId, debtsList[0].id, token, now, expiresAt)
      .run();

    // Generate portal link
    const portalLink = `${c.req.url.split('/api')[0]}/portal/${token}`;

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
      return c.json(
        { error: { code: 'EMAIL_FAILED', message: result.error || 'Failed to send email' } },
        500
      );
    }

    // Update all debts notification status
    for (const debt of debtsList) {
      await db
        .prepare(`
          UPDATE debts
          SET notification_sent = TRUE, notification_sent_at = ?, portal_token_id = ?
          WHERE id = ? AND tenant_id = ?
        `)
        .bind(now, tokenId, debt.id, tenantId)
        .run();

      // Create communication record for each debt
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
          tenantId,
          debt.id,
          'email',
          'outbound',
          `Upomínka ${debtsList.length} pohledávek`,
          `Bulk notification sent to debtor`,
          debtor.email,
          now,
          'sent',
          now
        )
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
    return c.json(
      { error: { code: 'SEND_ERROR', message: 'Failed to send notification' } },
      500
    );
  }
});
