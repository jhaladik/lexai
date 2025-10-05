// Cron job handlers for payment plan automation
// Scheduled via Cloudflare Workers cron triggers

interface Env {
  DB: D1Database;
}

// Send payment reminders 3 days before due date
export async function sendPaymentReminders(env: Env) {
  const db = env.DB;
  const now = Date.now();
  const threeDaysFromNow = now + (3 * 24 * 60 * 60 * 1000);

  try {
    // Get installments due in 3 days
    const installments = await db
      .prepare(`
        SELECT
          i.*,
          pp.debt_id,
          pp.tenant_id,
          d.reference_number,
          dt.email as debtor_email,
          dt.type as debtor_type,
          dt.first_name,
          dt.last_name,
          dt.company_name,
          c.company_name as client_company
        FROM installments i
        LEFT JOIN payment_plans pp ON i.payment_plan_id = pp.id
        LEFT JOIN debts d ON pp.debt_id = d.id
        LEFT JOIN debtors dt ON d.debtor_id = dt.id
        LEFT JOIN clients c ON d.client_id = c.id
        WHERE i.status = 'pending'
          AND i.paid = FALSE
          AND i.due_date >= ?
          AND i.due_date <= ?
      `)
      .bind(now, threeDaysFromNow)
      .all();

    for (const installment of installments.results || []) {
      // Create reminder communication
      const commId = `comm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db
        .prepare(`
          INSERT INTO communications (
            id, tenant_id, debt_id, type, direction, subject, content,
            to_email, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          commId,
          installment.tenant_id,
          installment.debt_id,
          'email',
          'outbound',
          'Připomínka splátky - Payment Reminder',
          `Your installment of ${installment.amount / 100} CZK is due in 3 days (${new Date(installment.due_date).toLocaleDateString('cs-CZ')}).\n\nPlease make sure to pay on time to avoid late fees.`,
          installment.debtor_email,
          'pending',
          now
        )
        .run();
    }

    console.log(`Sent ${installments.results?.length || 0} payment reminders`);
  } catch (error) {
    console.error('Error sending payment reminders:', error);
  }
}

// Process automatic charges on due date
export async function processAutoCharges(env: Env) {
  const db = env.DB;
  const now = Date.now();
  const today = new Date(now).setHours(0, 0, 0, 0);
  const tomorrow = today + (24 * 60 * 60 * 1000);

  try {
    // Get installments due today
    const installments = await db
      .prepare(`
        SELECT
          i.*,
          pp.debt_id,
          pp.tenant_id
        FROM installments i
        LEFT JOIN payment_plans pp ON i.payment_plan_id = pp.id
        WHERE i.status = 'pending'
          AND i.paid = FALSE
          AND i.due_date >= ?
          AND i.due_date < ?
      `)
      .bind(today, tomorrow)
      .all();

    for (const installment of installments.results || []) {
      // TODO: Implement Stripe auto-charge when card on file exists
      // For now, just mark as pending and send payment due email

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
          installment.tenant_id,
          installment.debt_id,
          'email',
          'outbound',
          'Splátka splatná dnes - Payment Due Today',
          `Your installment of ${installment.amount / 100} CZK is due today. Please pay to avoid late fees.`,
          'pending',
          now
        )
        .run();
    }

    console.log(`Processed ${installments.results?.length || 0} installments due today`);
  } catch (error) {
    console.error('Error processing auto charges:', error);
  }
}

// Check for overdue installments (2 days past due)
export async function checkOverdueInstallments(env: Env) {
  const db = env.DB;
  const now = Date.now();
  const twoDaysAgo = now - (2 * 24 * 60 * 60 * 1000);

  try {
    // Get installments 2 days overdue
    const installments = await db
      .prepare(`
        SELECT
          i.*,
          pp.debt_id,
          pp.tenant_id,
          dt.email as debtor_email
        FROM installments i
        LEFT JOIN payment_plans pp ON i.payment_plan_id = pp.id
        LEFT JOIN debts d ON pp.debt_id = d.id
        LEFT JOIN debtors dt ON d.debtor_id = dt.id
        WHERE i.status = 'pending'
          AND i.paid = FALSE
          AND i.due_date < ?
      `)
      .bind(twoDaysAgo)
      .all();

    for (const installment of installments.results || []) {
      // Mark as overdue
      await db
        .prepare(`UPDATE installments SET status = 'overdue' WHERE id = ?`)
        .bind(installment.id)
        .run();

      // Send overdue notice
      const commId = `comm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db
        .prepare(`
          INSERT INTO communications (
            id, tenant_id, debt_id, type, direction, subject, content,
            to_email, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          commId,
          installment.tenant_id,
          installment.debt_id,
          'email',
          'outbound',
          'URGENT: Splátka po splatnosti - Overdue Payment',
          `Your installment of ${installment.amount / 100} CZK is overdue. Grace period ending soon. Full balance may become due if not paid.`,
          installment.debtor_email,
          'pending',
          now
        )
        .run();
    }

    console.log(`Marked ${installments.results?.length || 0} installments as overdue`);
  } catch (error) {
    console.error('Error checking overdue installments:', error);
  }
}

// Trigger accelerations (5 days past due = end of grace period)
export async function triggerAccelerations(env: Env) {
  const db = env.DB;
  const now = Date.now();
  const fiveDaysAgo = now - (5 * 24 * 60 * 60 * 1000);
  const gracePeriodDays = 5;

  try {
    // Get payment plans with overdue installments past grace period
    const overdueInstallments = await db
      .prepare(`
        SELECT DISTINCT
          pp.id as plan_id,
          pp.debt_id,
          pp.tenant_id,
          pp.grace_period_days,
          i.due_date,
          dt.email as debtor_email,
          d.current_amount
        FROM installments i
        LEFT JOIN payment_plans pp ON i.payment_plan_id = pp.id
        LEFT JOIN debts d ON pp.debt_id = d.id
        LEFT JOIN debtors dt ON d.debtor_id = dt.id
        WHERE i.status = 'overdue'
          AND i.paid = FALSE
          AND pp.status = 'active'
          AND pp.acceleration_enabled = TRUE
          AND i.due_date < ?
      `)
      .bind(fiveDaysAgo)
      .all();

    for (const item of overdueInstallments.results || []) {
      // Trigger acceleration
      await db
        .prepare(`
          UPDATE payment_plans
          SET status = 'defaulted', default_date = ?
          WHERE id = ?
        `)
        .bind(now, item.plan_id)
        .run();

      // Update debt status
      await db
        .prepare(`
          UPDATE debts
          SET status = 'payment_plan_defaulted'
          WHERE id = ?
        `)
        .bind(item.debt_id)
        .run();

      // Mark unpaid installments as waived
      await db
        .prepare(`
          UPDATE installments
          SET status = 'waived'
          WHERE payment_plan_id = ? AND paid = FALSE
        `)
        .bind(item.plan_id)
        .run();

      // Send acceleration notice
      const commId = `comm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db
        .prepare(`
          INSERT INTO communications (
            id, tenant_id, debt_id, type, direction, subject, content,
            to_email, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          commId,
          item.tenant_id,
          item.debt_id,
          'email',
          'outbound',
          'URGENT: Celková částka splatná okamžitě - Full Balance Due',
          `Due to missed payment, your payment plan has been accelerated. Full remaining balance of ${item.current_amount / 100} CZK is now due immediately.\n\nPlease contact us immediately to discuss resolution.`,
          item.debtor_email,
          'pending',
          now
        )
        .run();
    }

    console.log(`Triggered ${overdueInstallments.results?.length || 0} accelerations`);
  } catch (error) {
    console.error('Error triggering accelerations:', error);
  }
}
