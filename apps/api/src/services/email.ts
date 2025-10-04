/**
 * Email service using SMTP2GO
 * All emails are sent to testing address: jozefhaladik@gmail.com
 */

const SMTP2GO_API_URL = 'https://api.smtp2go.com/v3/email/send';
const TEST_EMAIL = 'jozefhaladik@gmail.com';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  fromName?: string;
}

interface DebtNotificationData {
  debtorName: string;
  debtorEmail: string;
  clientName: string;
  debts: Array<{
    id: string;
    referenceNumber: string;
    debtType: string;
    amount: number;
    currency: string;
    dueDate: string;
    invoiceDate: string;
    description: string;
  }>;
  portalLink: string;
  language?: string;
}

export async function sendEmail(
  options: EmailOptions,
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(SMTP2GO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        to: [TEST_EMAIL], // Always send to test email
        sender: options.from || 'support@haladik.com',
        subject: `[TEST - Original: ${options.to}] ${options.subject}`,
        html_body: options.html,
        custom_headers: [
          {
            header: 'X-Original-Recipient',
            value: options.to,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok || data.data?.error) {
      return {
        success: false,
        error: data.data?.error || 'Failed to send email',
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate debt notification email HTML
 */
export function generateDebtNotificationEmail(data: DebtNotificationData): string {
  const lang = data.language || 'cs';

  const translations = {
    cs: {
      subject: 'Upomínka o nezaplacené pohledávce',
      subject_plural: 'Upomínka o nezaplacených pohledávkách',
      greeting: 'Vážený pane/paní',
      intro: 'obracíme se na Vás jménem naší klientky',
      debt_details: 've věci nezaplacené pohledávky',
      debts_details: 've věci nezaplacených pohledávek',
      reference: 'Číslo pohledávky',
      due_date: 'Datum splatnosti',
      invoice_date: 'Datum vystavení',
      type: 'Typ',
      amount: 'Dlužná částka',
      total_amount: 'Celková dlužná částka',
      portal_intro: 'Pro zobrazení detailů a úhradu pohledávky klikněte zde',
      portal_button: 'Zobrazit pohledávky',
      options: 'V portálu máte následující možnosti',
      option_pay: 'Zaplatit celou částku',
      option_plan: 'Navrhnout splátkový kalendář',
      option_dispute: 'Podat námitku s důkazy',
      regards: 'S pozdravem',
    },
    en: {
      subject: 'Payment Reminder',
      subject_plural: 'Payment Reminders',
      greeting: 'Dear Sir/Madam',
      intro: 'we are contacting you on behalf of our client',
      debt_details: 'regarding an unpaid debt',
      debts_details: 'regarding unpaid debts',
      reference: 'Reference Number',
      due_date: 'Due Date',
      invoice_date: 'Invoice Date',
      type: 'Type',
      amount: 'Amount Due',
      total_amount: 'Total Amount Due',
      portal_intro: 'To view details and pay, click here',
      portal_button: 'View Debts',
      options: 'In the portal you have the following options',
      option_pay: 'Pay the full amount',
      option_plan: 'Propose a payment plan',
      option_dispute: 'Submit a dispute with evidence',
      regards: 'Best regards',
    },
  };

  const t = translations[lang as keyof typeof translations] || translations.cs;
  const totalAmount = data.debts.reduce((sum, debt) => sum + debt.amount, 0);
  const isMultiple = data.debts.length > 1;

  return `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isMultiple ? t.subject_plural : t.subject}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background-color: #3b82f6;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .content {
      background-color: #f9fafb;
      padding: 30px;
      border: 1px solid #e5e7eb;
      border-top: none;
    }
    .debt-details {
      background-color: white;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      border: 1px solid #e5e7eb;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .label {
      color: #6b7280;
      font-weight: 600;
    }
    .value {
      color: #111827;
      font-weight: 700;
    }
    .amount {
      font-size: 24px;
      color: #dc2626;
    }
    .button {
      display: inline-block;
      background-color: #3b82f6;
      color: white;
      padding: 12px 30px;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
      font-weight: 600;
    }
    .options {
      background-color: white;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .options ul {
      list-style: none;
      padding: 0;
    }
    .options li {
      padding: 8px 0;
      padding-left: 25px;
      position: relative;
    }
    .options li:before {
      content: "✓";
      position: absolute;
      left: 0;
      color: #10b981;
      font-weight: bold;
    }
    .footer {
      text-align: center;
      color: #6b7280;
      font-size: 12px;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
    }
    table.debts-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      background: white;
      border-radius: 8px;
      overflow: hidden;
    }
    table.debts-table th {
      background-color: #f3f4f6;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #374151;
      border-bottom: 2px solid #e5e7eb;
    }
    table.debts-table td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    table.debts-table tr:last-child td {
      border-bottom: none;
    }
    table.debts-table tfoot td {
      background-color: #fef2f2;
      font-weight: 700;
      font-size: 16px;
      color: #dc2626;
      border-top: 2px solid #dc2626;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${isMultiple ? t.subject_plural : t.subject}</h1>
  </div>

  <div class="content">
    <p><strong>${t.greeting},</strong></p>

    <p>${t.intro} <strong>${data.clientName}</strong> ${isMultiple ? t.debts_details : t.debt_details}:</p>

    <table class="debts-table">
      <thead>
        <tr>
          <th>${t.reference}</th>
          <th>${t.type}</th>
          <th>${t.invoice_date}</th>
          <th>${t.due_date}</th>
          <th style="text-align: right;">${t.amount}</th>
        </tr>
      </thead>
      <tbody>
        ${data.debts.map(debt => `
          <tr>
            <td><strong>${debt.referenceNumber}</strong></td>
            <td>${debt.debtType}</td>
            <td>${debt.invoiceDate}</td>
            <td>${debt.dueDate}</td>
            <td style="text-align: right; font-weight: 600;">${debt.amount.toLocaleString()} ${debt.currency}</td>
          </tr>
          ${debt.description ? `
          <tr>
            <td colspan="5" style="padding-top: 0; padding-bottom: 12px; font-size: 13px; color: #6b7280;"><em>${debt.description}</em></td>
          </tr>
          ` : ''}
        `).join('')}
      </tbody>
      ${isMultiple ? `
      <tfoot>
        <tr>
          <td colspan="4">${t.total_amount}:</td>
          <td style="text-align: right;">${totalAmount.toLocaleString()} ${data.debts[0].currency}</td>
        </tr>
      </tfoot>
      ` : ''}
    </table>

    <p>${t.portal_intro}:</p>

    <div style="text-align: center;">
      <a href="${data.portalLink}" class="button">${t.portal_button}</a>
    </div>

    <div class="options">
      <strong>${t.options}:</strong>
      <ul>
        <li>${t.option_pay}</li>
        <li>${t.option_plan}</li>
        <li>${t.option_dispute}</li>
      </ul>
    </div>

    <p>${t.regards},<br>
    <strong>${data.clientName}</strong></p>
  </div>

  <div class="footer">
    <p>LexAI - Automated Debt Collection Platform</p>
  </div>
</body>
</html>
  `;
}

/**
 * Send debt notification email to debtor
 */
export async function sendDebtNotification(
  data: DebtNotificationData,
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  const html = generateDebtNotificationEmail(data);
  const lang = data.language || 'cs';
  const isMultiple = data.debts.length > 1;

  const subjects = {
    cs: isMultiple ? `Upomínka ${data.debts.length} pohledávek` : `Upomínka pohledávky ${data.debts[0].referenceNumber}`,
    en: isMultiple ? `${data.debts.length} Payment Reminders` : `Payment Reminder ${data.debts[0].referenceNumber}`,
  };

  const subject = subjects[lang as keyof typeof subjects] || subjects.cs;

  return sendEmail(
    {
      to: data.debtorEmail,
      subject,
      html,
      from: 'support@haladik.com',
      fromName: data.clientName,
    },
    apiKey
  );
}
