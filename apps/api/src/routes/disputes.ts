import { Hono } from 'hono';
import { sendDisputeNotificationEmail, sendDisputeResolutionEmail } from '../services/email';

export const disputeRoutes = new Hono();

// GET /api/v1/disputes - List all disputes (attorney view)
disputeRoutes.get('/', async (c) => {
  const db = c.env.DB as D1Database;
  const user = c.get('user');

  const status = c.req.query('status'); // open, under_review, resolved, rejected
  const disputeType = c.req.query('type');

  try {
    let query = `
      SELECT
        d.*,
        debt.reference_number as debt_reference,
        debt.original_amount as debt_amount,
        debt.currency,
        debtor.type as debtor_type,
        debtor.first_name as debtor_first_name,
        debtor.last_name as debtor_last_name,
        debtor.company_name as debtor_company,
        debtor.email as debtor_email,
        client.company_name as client_company,
        client.email as client_email,
        resolver.first_name as resolved_by_first_name,
        resolver.last_name as resolved_by_last_name
      FROM disputes d
      LEFT JOIN debts debt ON d.debt_id = debt.id
      LEFT JOIN debtors debtor ON debt.debtor_id = debtor.id
      LEFT JOIN clients client ON debt.client_id = client.id
      LEFT JOIN users resolver ON d.resolved_by = resolver.id
      WHERE d.tenant_id = ?
    `;

    const bindings = [user.tenant_id];

    if (status) {
      query += ` AND d.status = ?`;
      bindings.push(status);
    }

    if (disputeType) {
      query += ` AND d.dispute_type = ?`;
      bindings.push(disputeType);
    }

    query += ` ORDER BY d.created_at DESC`;

    const result = await db.prepare(query).bind(...bindings).all();

    return c.json({ data: result.results || [] });
  } catch (error) {
    console.error('Error fetching disputes:', error);
    return c.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to fetch disputes' } },
      500
    );
  }
});

// GET /api/v1/disputes/:id - Get single dispute with full details
disputeRoutes.get('/:id', async (c) => {
  const db = c.env.DB as D1Database;
  const user = c.get('user');
  const disputeId = c.req.param('id');

  try {
    const dispute = await db.prepare(`
      SELECT
        d.*,
        debt.reference_number as debt_reference,
        debt.original_amount as debt_amount,
        debt.current_amount,
        debt.currency,
        debt.invoice_date,
        debt.due_date,
        debt.debt_type,
        debt.notes as debt_notes,
        debtor.type as debtor_type,
        debtor.first_name as debtor_first_name,
        debtor.last_name as debtor_last_name,
        debtor.company_name as debtor_company,
        debtor.email as debtor_email,
        debtor.phone as debtor_phone,
        debtor.address as debtor_address,
        debtor.city as debtor_city,
        client.company_name as client_company,
        client.email as client_email,
        client.phone as client_phone,
        resolver.first_name as resolved_by_first_name,
        resolver.last_name as resolved_by_last_name
      FROM disputes d
      LEFT JOIN debts debt ON d.debt_id = debt.id
      LEFT JOIN debtors debtor ON debt.debtor_id = debtor.id
      LEFT JOIN clients client ON debt.client_id = client.id
      LEFT JOIN users resolver ON d.resolved_by = resolver.id
      WHERE d.id = ? AND d.tenant_id = ?
    `).bind(disputeId, user.tenant_id).first();

    if (!dispute) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Dispute not found' } },
        404
      );
    }

    // Get supporting documents
    const documents = await db.prepare(`
      SELECT * FROM documents
      WHERE debt_id = ? AND type IN ('contract', 'invoice', 'delivery_proof', 'other')
      ORDER BY uploaded_at DESC
    `).bind(dispute.debt_id).all();

    // Get communications/messages related to this dispute
    const communications = await db.prepare(`
      SELECT * FROM communications
      WHERE debt_id = ?
      ORDER BY created_at DESC
      LIMIT 20
    `).bind(dispute.debt_id).all();

    return c.json({
      data: {
        ...dispute,
        supporting_documents: dispute.supporting_documents ? JSON.parse(dispute.supporting_documents) : [],
        documents: documents.results || [],
        communications: communications.results || []
      }
    });
  } catch (error) {
    console.error('Error fetching dispute:', error);
    return c.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to fetch dispute' } },
      500
    );
  }
});

// PUT /api/v1/disputes/:id/resolve - Resolve dispute
disputeRoutes.put('/:id/resolve', async (c) => {
  const db = c.env.DB as D1Database;
  const smtp2goApiKey = c.env.SMTP2GO_API_KEY;
  const user = c.get('user');
  const disputeId = c.req.param('id');

  const { outcome, resolution, new_amount, debt_status } = await c.req.json();
  // outcome: 'upheld' | 'rejected' | 'partial'
  // resolution: attorney's written explanation
  // new_amount: if partial resolution, the adjusted amount
  // debt_status: new debt status after resolution

  try {
    // Get dispute details
    const dispute = await db.prepare(`
      SELECT
        d.*,
        debt.reference_number,
        debt.original_amount,
        debt.client_id,
        debtor.email as debtor_email,
        debtor.first_name as debtor_first_name,
        debtor.last_name as debtor_last_name,
        debtor.company_name as debtor_company,
        debtor.type as debtor_type,
        client.company_name as client_company,
        client.email as client_email
      FROM disputes d
      LEFT JOIN debts debt ON d.debt_id = debt.id
      LEFT JOIN debtors debtor ON debt.debtor_id = debtor.id
      LEFT JOIN clients client ON debt.client_id = client.id
      WHERE d.id = ? AND d.tenant_id = ?
    `).bind(disputeId, user.tenant_id).first();

    if (!dispute) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Dispute not found' } },
        404
      );
    }

    if (dispute.status !== 'open' && dispute.status !== 'under_review') {
      return c.json(
        { error: { code: 'ALREADY_RESOLVED', message: 'Dispute already resolved' } },
        400
      );
    }

    const now = Date.now();
    const newStatus = outcome === 'upheld' ? 'resolved' : 'rejected';

    // Update dispute record
    await db.prepare(`
      UPDATE disputes
      SET status = ?, resolution = ?, resolved_by = ?, resolved_at = ?
      WHERE id = ?
    `).bind(newStatus, resolution, user.id, now, disputeId).run();

    // Update debt based on outcome
    if (outcome === 'upheld') {
      // Debt is closed or written off
      await db.prepare(`
        UPDATE debts
        SET status = ?, current_amount = 0
        WHERE id = ?
      `).bind('written_off', dispute.debt_id).run();
    } else if (outcome === 'partial' && new_amount) {
      // Adjust debt amount
      await db.prepare(`
        UPDATE debts
        SET current_amount = ?, status = ?
        WHERE id = ?
      `).bind(new_amount, debt_status || 'verified', dispute.debt_id).run();
    } else if (outcome === 'rejected') {
      // Resume collection - restore to previous status or set to verified
      await db.prepare(`
        UPDATE debts
        SET status = ?
        WHERE id = ?
      `).bind(debt_status || 'verified', dispute.debt_id).run();
    }

    // Create communication record
    const commId = `comm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db.prepare(`
      INSERT INTO communications (
        id, tenant_id, debt_id, type, direction, subject, content,
        status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      commId,
      user.tenant_id,
      dispute.debt_id,
      'email',
      'outbound',
      `Dispute Resolution: ${outcome}`,
      `Attorney resolved dispute with outcome: ${outcome}. Resolution: ${resolution}`,
      'pending',
      now
    ).run();

    // Send email notifications
    const debtorName = dispute.debtor_type === 'business'
      ? dispute.debtor_company
      : `${dispute.debtor_first_name} ${dispute.debtor_last_name}`;

    try {
      await sendDisputeResolutionEmail({
        debtorEmail: dispute.debtor_email,
        debtorName,
        clientName: dispute.client_company,
        referenceNumber: dispute.reference_number,
        disputeType: dispute.dispute_type,
        outcome,
        resolution,
        newAmount: new_amount,
        originalAmount: dispute.original_amount,
        language: 'cs'
      }, smtp2goApiKey);

      // Update communication status
      await db.prepare(`
        UPDATE communications SET status = ?, sent_at = ?
        WHERE id = ?
      `).bind('sent', now, commId).run();
    } catch (emailError) {
      console.error('Failed to send dispute resolution email:', emailError);
    }

    return c.json({
      data: {
        message: 'Dispute resolved successfully',
        dispute_id: disputeId,
        outcome,
        new_status: newStatus
      }
    });
  } catch (error) {
    console.error('Error resolving dispute:', error);
    return c.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to resolve dispute' } },
      500
    );
  }
});

// PUT /api/v1/disputes/:id/status - Update dispute status (for workflow)
disputeRoutes.put('/:id/status', async (c) => {
  const db = c.env.DB as D1Database;
  const user = c.get('user');
  const disputeId = c.req.param('id');
  const { status } = await c.req.json();

  try {
    await db.prepare(`
      UPDATE disputes SET status = ? WHERE id = ? AND tenant_id = ?
    `).bind(status, disputeId, user.tenant_id).run();

    return c.json({ data: { message: 'Status updated', status } });
  } catch (error) {
    console.error('Error updating dispute status:', error);
    return c.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to update status' } },
      500
    );
  }
});

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
