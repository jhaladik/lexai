import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';

export const attorneyLetterRoutes = new Hono();

// Protected routes (require authentication)
attorneyLetterRoutes.use('/*', requireAuth);

// POST /api/v1/attorney-letters/generate - Generate attorney letter for a debt
attorneyLetterRoutes.post('/generate', async (c) => {
  const db = c.env.DB as D1Database;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const userRole = c.get('userRole');

  // Only attorneys can generate letters
  if (userRole !== 'attorney' && userRole !== 'admin') {
    return c.json(
      { error: { code: 'FORBIDDEN', message: 'Only attorneys can generate letters' } },
      403
    );
  }

  const { debt_id, letter_type = 'attorney', custom_message } = await c.req.json();

  try {
    // Get debt details with all related information
    const debt = await db.prepare(`
      SELECT
        d.*,
        debtor.type as debtor_type,
        debtor.first_name as debtor_first_name,
        debtor.last_name as debtor_last_name,
        debtor.company_name as debtor_company,
        debtor.email as debtor_email,
        debtor.address as debtor_address,
        debtor.city as debtor_city,
        debtor.postal_code as debtor_postal_code,
        debtor.country as debtor_country,
        client.company_name as client_company,
        client.address as client_address,
        client.registration_number as client_ico,
        client_user.email as client_email,
        client_user.first_name as client_first_name,
        client_user.last_name as client_last_name,
        attorney.first_name as attorney_first_name,
        attorney.last_name as attorney_last_name
      FROM debts d
      LEFT JOIN debtors debtor ON d.debtor_id = debtor.id
      LEFT JOIN clients client ON d.client_id = client.id
      LEFT JOIN users client_user ON client.user_id = client_user.id
      LEFT JOIN users attorney ON d.assigned_attorney = attorney.id
      WHERE d.id = ? AND d.tenant_id = ?
    `).bind(debt_id, tenantId).first();

    if (!debt) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Debt not found' } },
        404
      );
    }

    // Get tenant information for branding
    const tenant = await db.prepare(`
      SELECT * FROM tenants WHERE id = ?
    `).bind(tenantId).first();

    // Generate letter HTML content
    const letterHtml = generateAttorneyLetterHTML({
      debt,
      tenant,
      attorney: {
        first_name: debt.attorney_first_name || c.get('userFirstName') || 'Attorney',
        last_name: debt.attorney_last_name || c.get('userLastName') || 'Name',
      },
      custom_message,
      letter_type,
    });

    // Create document record
    const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    await db.prepare(`
      INSERT INTO documents (
        id, tenant_id, debt_id, type, filename, file_url,
        uploaded_by, uploaded_at, generated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      documentId,
      tenantId,
      debt_id,
      'attorney_letter',
      `attorney_letter_${debt_id}_${now}.html`,
      `/documents/${documentId}`, // We'll store HTML content in metadata for now
      userId,
      now,
      true
    ).run();

    return c.json({
      data: {
        document_id: documentId,
        letter_html: letterHtml,
        debt_id,
        message: 'Attorney letter generated successfully',
      },
    });
  } catch (error) {
    console.error('Error generating attorney letter:', error);
    return c.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to generate attorney letter' } },
      500
    );
  }
});

// POST /api/v1/attorney-letters/:id/send - Sign and send attorney letter
attorneyLetterRoutes.post('/:id/send', async (c) => {
  const db = c.env.DB as D1Database;
  const smtp2goApiKey = c.env.SMTP2GO_API_KEY;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const userRole = c.get('userRole');
  const documentId = c.req.param('id');

  // Only attorneys can send letters
  if (userRole !== 'attorney' && userRole !== 'admin') {
    return c.json(
      { error: { code: 'FORBIDDEN', message: 'Only attorneys can send letters' } },
      403
    );
  }

  try {
    // Get document and debt details
    const document = await db.prepare(`
      SELECT * FROM documents WHERE id = ? AND tenant_id = ?
    `).bind(documentId, tenantId).first();

    if (!document) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Attorney letter not found' } },
        404
      );
    }

    // Get debt details
    const debt = await db.prepare(`
      SELECT
        d.*,
        debtor.email as debtor_email,
        debtor.first_name as debtor_first_name,
        debtor.last_name as debtor_last_name,
        debtor.company_name as debtor_company,
        debtor.type as debtor_type,
        client.company_name as client_company
      FROM debts d
      LEFT JOIN debtors debtor ON d.debtor_id = debtor.id
      LEFT JOIN clients client ON d.client_id = client.id
      WHERE d.id = ? AND d.tenant_id = ?
    `).bind(document.debt_id, tenantId).first();

    if (!debt) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Debt not found' } },
        404
      );
    }

    const now = Date.now();
    const debtorName = debt.debtor_type === 'business'
      ? debt.debtor_company
      : `${debt.debtor_first_name} ${debt.debtor_last_name}`;

    // Send email with attorney letter
    const emailSubject = `Právní upomínka - dluh ${debt.reference_number || debt.id.slice(-8)}`;
    const emailBody = `
      <p>Vážený/á ${debtorName},</p>

      <p>V příloze naleznete právní upomínku týkající se nezaplacené pohledávky.</p>

      <p><strong>Referenční číslo:</strong> ${debt.reference_number || debt.id}</p>
      <p><strong>Dlužná částka:</strong> ${(debt.current_amount / 100).toLocaleString()} ${debt.currency}</p>
      <p><strong>Lhůta k úhradě:</strong> 15 dní od doručení tohoto dopisu</p>

      <p>Pro úhradu pohledávky nebo komunikaci s námi prosím využijte náš portál:</p>
      <p><a href="${c.env.WEB_URL || 'http://localhost:5173'}/portal/${debt.id}">Otevřít portál</a></p>

      <p>S pozdravem,<br>
      ${client.company_name}</p>
    `;

    // Send email via SMTP2GO
    try {
      const emailResponse = await fetch('https://api.smtp2go.com/v3/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: smtp2goApiKey,
          to: [debt.debtor_email],
          sender: `${debt.client_company} <noreply@lexai.com>`,
          subject: emailSubject,
          html_body: emailBody,
        }),
      });

      const emailResult = await emailResponse.json();

      if (!emailResponse.ok) {
        console.error('Email sending failed:', emailResult);
        throw new Error('Failed to send email');
      }
    } catch (emailError) {
      console.error('Email error:', emailError);
    }

    // Create communication record
    const commId = `comm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db.prepare(`
      INSERT INTO communications (
        id, tenant_id, debt_id, type, direction, subject, content,
        letter_type, signed_by, status, sent_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      commId,
      tenantId,
      debt.id,
      'letter',
      'outbound',
      emailSubject,
      'Attorney demand letter sent',
      'attorney',
      userId,
      'sent',
      now,
      now
    ).run();

    // Update debt status to attorney_letter_sent
    await db.prepare(`
      UPDATE debts
      SET status = ?, assigned_attorney = ?
      WHERE id = ? AND tenant_id = ?
    `).bind('attorney_letter_sent', userId, debt.id, tenantId).run();

    return c.json({
      data: {
        message: 'Attorney letter sent successfully',
        communication_id: commId,
        sent_to: debt.debtor_email,
        sent_at: now,
      },
    });
  } catch (error) {
    console.error('Error sending attorney letter:', error);
    return c.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to send attorney letter' } },
      500
    );
  }
});

// Helper function to generate attorney letter HTML
function generateAttorneyLetterHTML(data: any): string {
  const { debt, tenant, attorney, custom_message, letter_type } = data;
  const now = new Date();
  const deadline = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 days from now

  const debtorName = debt.debtor_type === 'business'
    ? debt.debtor_company
    : `${debt.debtor_first_name} ${debt.debtor_last_name}`;

  const debtorAddress = `${debt.debtor_address}, ${debt.debtor_postal_code} ${debt.debtor_city}`;

  return `
<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .letterhead {
      text-align: right;
      border-bottom: 2px solid ${tenant?.primary_color || '#3b82f6'};
      padding-bottom: 20px;
      margin-bottom: 40px;
    }
    .letterhead h1 {
      color: ${tenant?.primary_color || '#3b82f6'};
      margin: 0;
      font-size: 24px;
    }
    .recipient {
      margin-bottom: 40px;
    }
    .content {
      margin-bottom: 40px;
    }
    .highlight {
      background-color: #fef3c7;
      padding: 20px;
      border-left: 4px solid #f59e0b;
      margin: 20px 0;
    }
    .signature {
      margin-top: 60px;
    }
    .footer {
      border-top: 1px solid #ddd;
      padding-top: 20px;
      margin-top: 60px;
      font-size: 12px;
      color: #666;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    table td {
      padding: 8px;
      border-bottom: 1px solid #eee;
    }
    table td:first-child {
      font-weight: bold;
      width: 200px;
    }
  </style>
</head>
<body>
  <div class="letterhead">
    <h1>${tenant?.name || 'Law Firm Name'}</h1>
    <p>Právní služby • Vymáhání pohledávek</p>
  </div>

  <div class="recipient">
    <p><strong>${debtorName}</strong><br>
    ${debtorAddress}</p>
  </div>

  <p><strong>Datum:</strong> ${now.toLocaleDateString('cs-CZ')}<br>
  <strong>Číslo jednací:</strong> ${debt.reference_number || debt.id.slice(-8)}</p>

  <h2 style="color: ${tenant?.primary_color || '#3b82f6'}; margin-top: 40px;">
    PRÁVNÍ UPOMÍNKA - VÝZVA K ÚHRADĚ DLUHU
  </h2>

  <div class="content">
    <p>Vážený/á ${debtorName},</p>

    <p>jménem našeho klienta, společnosti <strong>${debt.client_company}</strong>,
    se na Vás obracíme ve věci <strong>nezaplacené pohledávky</strong> v celkové výši
    <strong>${(debt.current_amount / 100).toLocaleString()} ${debt.currency}</strong>.</p>

    <table>
      <tr>
        <td>Referenční číslo:</td>
        <td>${debt.reference_number || 'N/A'}</td>
      </tr>
      <tr>
        <td>Typ pohledávky:</td>
        <td>${debt.debt_type}</td>
      </tr>
      <tr>
        <td>Původní částka:</td>
        <td>${(debt.original_amount / 100).toLocaleString()} ${debt.currency}</td>
      </tr>
      <tr>
        <td>Aktuální dlužná částka:</td>
        <td><strong>${(debt.current_amount / 100).toLocaleString()} ${debt.currency}</strong></td>
      </tr>
      <tr>
        <td>Datum splatnosti:</td>
        <td>${new Date(debt.due_date).toLocaleDateString('cs-CZ')}</td>
      </tr>
      <tr>
        <td>Dní po splatnosti:</td>
        <td>${Math.floor((now.getTime() - debt.due_date) / (1000 * 60 * 60 * 24))} dní</td>
      </tr>
    </table>

    <div class="highlight">
      <p><strong>⚠️ VÝZVA K ÚHRADĚ</strong></p>
      <p>Vyzýváme Vás tímto k úhradě výše uvedené pohledávky <strong>nejpozději do ${deadline.toLocaleDateString('cs-CZ')}</strong>,
      tedy do 15 dnů od doručení tohoto dopisu.</p>
    </div>

    ${custom_message ? `<p>${custom_message}</p>` : ''}

    <p><strong>V případě neuhrazení pohledávky ve stanovené lhůtě budeme nuceni:</strong></p>
    <ul>
      <li>Zahájit soudní řízení o vymožení pohledávky</li>
      <li>Požadovat úhradu soudních poplatků a nákladů řízení</li>
      <li>Požadovat úhradu nákladů právního zastoupení</li>
      <li>Požadovat úhradu zákonných úroků z prodlení</li>
    </ul>

    <p><strong>Možnosti řešení situace:</strong></p>
    <ol>
      <li><strong>Okamžitá úhrada</strong> celé dlužné částky</li>
      <li><strong>Splátkový kalendář</strong> - kontaktujte nás pro dohodnutí splátkového kalendáře</li>
      <li><strong>Námitka</strong> - pokud máte důvodné námitky proti pohledávce, prosím nás neprodleně kontaktujte</li>
    </ol>

    <p>Pro úhradu nebo komunikaci využijte náš online portál, kde naleznete všechny potřebné informace
    a možnosti platby.</p>

    <p>V případě jakýchkoliv dotazů nebo nejasností nás neváhejte kontaktovat.</p>

    <p>S pozdravem,</p>
  </div>

  <div class="signature">
    <p><strong>${attorney.first_name} ${attorney.last_name}</strong><br>
    Advokát<br>
    ${tenant?.name || 'Law Firm'}</p>
    <p><em>Elektronicky podepsáno dne ${now.toLocaleDateString('cs-CZ')} v ${now.toLocaleTimeString('cs-CZ')}</em></p>
  </div>

  <div class="footer">
    <p>${tenant?.name || 'Law Firm Name'} | ${tenant?.country || 'Czech Republic'}</p>
    <p>Tento dopis byl vygenerován elektronicky a je platný i bez vlastnoručního podpisu.</p>
  </div>
</body>
</html>
  `.trim();
}
