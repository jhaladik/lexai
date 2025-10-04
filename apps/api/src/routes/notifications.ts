import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { sendDebtNotification } from '../services/email';

export const notificationRoutes = new Hono();

// All routes require authentication
notificationRoutes.use('*', requireAuth);

// POST /api/v1/notifications/debt/:debtId - Send debt notification to debtor
notificationRoutes.post('/debt/:debtId', async (c) => {
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const debtId = c.req.param('debtId');
  const db = c.env.DB as D1Database;
  const smtp2goApiKey = c.env.SMTP2GO_API_KEY;

  if (!smtp2goApiKey) {
    return c.json(
      { error: { code: 'CONFIG_ERROR', message: 'Email service not configured' } },
      500
    );
  }

  try {
    // Fetch debt with client and debtor details
    const debt = await db
      .prepare(`
        SELECT
          d.*,
          c.company_name as client_company,
          dt.type as debtor_type,
          dt.first_name as debtor_first_name,
          dt.last_name as debtor_last_name,
          dt.company_name as debtor_company,
          dt.email as debtor_email,
          dt.phone as debtor_phone
        FROM debts d
        LEFT JOIN clients c ON d.client_id = c.id
        LEFT JOIN debtors dt ON d.debtor_id = dt.id
        WHERE d.id = ? AND d.tenant_id = ?
      `)
      .bind(debtId, tenantId)
      .first();

    if (!debt) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Debt not found' } },
        404
      );
    }

    // Check if debtor has email
    if (!debt.debtor_email) {
      return c.json(
        { error: { code: 'NO_EMAIL', message: 'Debtor has no email address' } },
        400
      );
    }

    // Generate portal token
    const tokenId = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const token = `${debtId}_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
    const now = Date.now();
    const expiresAt = now + (90 * 24 * 60 * 60 * 1000); // 90 days

    await db
      .prepare(`
        INSERT INTO portal_tokens (
          id, tenant_id, debt_id, token, created_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(tokenId, tenantId, debtId, token, now, expiresAt)
      .run();

    // Generate portal link (will be public URL)
    const portalLink = `${c.req.url.split('/api')[0]}/portal/${token}`;

    // Prepare email data
    const debtorName = debt.debtor_type === 'business'
      ? debt.debtor_company
      : `${debt.debtor_first_name} ${debt.debtor_last_name}`;

    const emailData = {
      debtorName,
      debtorEmail: debt.debtor_email as string,
      clientName: debt.client_company as string,
      debts: [{
        id: debt.id as string,
        referenceNumber: (debt.reference_number as string) || debt.id as string,
        debtType: debt.debt_type as string,
        amount: debt.original_amount as number,
        currency: debt.currency as string,
        dueDate: new Date(debt.due_date as number).toLocaleDateString('cs-CZ'),
        invoiceDate: new Date(debt.invoice_date as number).toLocaleDateString('cs-CZ'),
        description: (debt.notes as string) || '',
      }],
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

    // Update debt notification status
    await db
      .prepare(`
        UPDATE debts
        SET notification_sent = TRUE, notification_sent_at = ?, portal_token_id = ?
        WHERE id = ? AND tenant_id = ?
      `)
      .bind(now, tokenId, debtId, tenantId)
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
        tenantId,
        debtId,
        'email',
        'outbound',
        `Upomínka pohledávky ${emailData.debts[0].referenceNumber}`,
        `Notification sent to debtor`,
        debt.debtor_email,
        now,
        'sent',
        now
      )
      .run();

    return c.json({
      data: {
        message: 'Notification sent successfully',
        portal_link: portalLink,
        sent_to: debt.debtor_email,
        token_expires_at: expiresAt,
      }
    });

  } catch (error) {
    console.error('Error sending notification:', error);
    return c.json(
      { error: { code: 'SEND_ERROR', message: 'Failed to send notification' } },
      500
    );
  }
});

// GET /api/v1/notifications/debt/:debtId/status - Check notification status
notificationRoutes.get('/debt/:debtId/status', async (c) => {
  const tenantId = c.get('tenantId');
  const debtId = c.req.param('debtId');
  const db = c.env.DB as D1Database;

  try {
    const debt = await db
      .prepare(`
        SELECT
          notification_sent,
          notification_sent_at,
          portal_token_id
        FROM debts
        WHERE id = ? AND tenant_id = ?
      `)
      .bind(debtId, tenantId)
      .first();

    if (!debt) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Debt not found' } },
        404
      );
    }

    // Get portal token info if exists
    let tokenInfo = null;
    if (debt.portal_token_id) {
      tokenInfo = await db
        .prepare(`
          SELECT token, expires_at, last_accessed_at, access_count
          FROM portal_tokens
          WHERE id = ?
        `)
        .bind(debt.portal_token_id)
        .first();
    }

    return c.json({
      data: {
        notification_sent: debt.notification_sent,
        notification_sent_at: debt.notification_sent_at,
        portal_token: tokenInfo,
      }
    });

  } catch (error) {
    console.error('Error checking notification status:', error);
    return c.json(
      { error: { code: 'DATABASE_ERROR', message: 'Failed to check status' } },
      500
    );
  }
});
