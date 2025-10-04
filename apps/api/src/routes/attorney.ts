import { Hono } from 'hono';
import { requireAuth, requireRole } from '../middleware/auth';

export const attorneyRoutes = new Hono();

// All routes require authentication and attorney role
attorneyRoutes.use('*', requireAuth, requireRole('admin', 'attorney'));

// GET /api/v1/attorney/review-queue - Get debts pending review
attorneyRoutes.get('/review-queue', async (c) => {
  const tenantId = c.get('tenantId');
  const db = c.env.DB as D1Database;

  // Query parameters for filtering
  const status = c.req.query('status') || 'pending_verification';
  const sortBy = c.req.query('sort') || 'fraud_score'; // fraud_score, created_at, amount
  const groupBy = c.req.query('group') || 'debtor'; // debtor, individual

  try {
    if (groupBy === 'debtor') {
      // Group by debtor-client pairs for efficient review
      const debtorGroups = await db
        .prepare(`
          SELECT
            dt.id as debtor_id,
            dt.type as debtor_type,
            dt.first_name,
            dt.last_name,
            dt.company_name,
            dt.email,
            c.id as client_id,
            c.company_name as client_company,
            dcr.id as relationship_id,
            dcr.verified as relationship_verified,
            dcr.trust_level,
            COUNT(d.id) as pending_debts_count,
            SUM(d.current_amount) as total_amount,
            MAX(d.fraud_score) as max_fraud_score,
            MIN(d.created_at) as first_debt_date,
            MAX(d.created_at) as last_debt_date
          FROM debts d
          LEFT JOIN debtors dt ON d.debtor_id = dt.id
          LEFT JOIN clients c ON d.client_id = c.id
          LEFT JOIN debtor_client_relationships dcr
            ON dcr.debtor_id = dt.id
            AND dcr.client_id = c.id
            AND dcr.tenant_id = d.tenant_id
          WHERE d.tenant_id = ?
            AND d.status = ?
          GROUP BY dt.id, c.id
          ORDER BY
            CASE WHEN ? = 'fraud_score' THEN max_fraud_score END DESC,
            CASE WHEN ? = 'created_at' THEN first_debt_date END DESC,
            CASE WHEN ? = 'amount' THEN total_amount END DESC
        `)
        .bind(tenantId, status, sortBy, sortBy, sortBy)
        .all();

      return c.json({
        data: {
          view: 'grouped',
          groups: debtorGroups.results || [],
        }
      });
    } else {
      // Individual debt list
      const debts = await db
        .prepare(`
          SELECT
            d.*,
            dt.type as debtor_type,
            dt.first_name as debtor_first_name,
            dt.last_name as debtor_last_name,
            dt.company_name as debtor_company,
            dt.email as debtor_email,
            c.company_name as client_company,
            dcr.verified as relationship_verified,
            dcr.trust_level
          FROM debts d
          LEFT JOIN debtors dt ON d.debtor_id = dt.id
          LEFT JOIN clients c ON d.client_id = c.id
          LEFT JOIN debtor_client_relationships dcr
            ON dcr.debtor_id = dt.id
            AND dcr.client_id = c.id
            AND dcr.tenant_id = d.tenant_id
          WHERE d.tenant_id = ?
            AND d.status = ?
          ORDER BY
            CASE WHEN ? = 'fraud_score' THEN d.fraud_score END DESC,
            CASE WHEN ? = 'created_at' THEN d.created_at END DESC,
            CASE WHEN ? = 'amount' THEN d.current_amount END DESC
        `)
        .bind(tenantId, status, sortBy, sortBy, sortBy)
        .all();

      return c.json({
        data: {
          view: 'individual',
          debts: debts.results || [],
        }
      });
    }
  } catch (error) {
    console.error('Error fetching review queue:', error);
    return c.json(
      { error: { code: 'DATABASE_ERROR', message: 'Failed to fetch review queue' } },
      500
    );
  }
});

// GET /api/v1/attorney/debtor-group/:debtorId/:clientId - Get all debts for a debtor-client pair
attorneyRoutes.get('/debtor-group/:debtorId/:clientId', async (c) => {
  const tenantId = c.get('tenantId');
  const debtorId = c.req.param('debtorId');
  const clientId = c.req.param('clientId');
  const db = c.env.DB as D1Database;

  try {
    // Get relationship info
    const relationship = await db
      .prepare(`
        SELECT * FROM debtor_client_relationships
        WHERE tenant_id = ? AND debtor_id = ? AND client_id = ?
      `)
      .bind(tenantId, debtorId, clientId)
      .first();

    // Get all debts for this pair
    const debts = await db
      .prepare(`
        SELECT d.*,
          dt.type as debtor_type,
          dt.first_name as debtor_first_name,
          dt.last_name as debtor_last_name,
          dt.company_name as debtor_company,
          c.company_name as client_company
        FROM debts d
        LEFT JOIN debtors dt ON d.debtor_id = dt.id
        LEFT JOIN clients c ON d.client_id = c.id
        WHERE d.tenant_id = ?
          AND d.debtor_id = ?
          AND d.client_id = ?
        ORDER BY d.created_at DESC
      `)
      .bind(tenantId, debtorId, clientId)
      .all();

    return c.json({
      data: {
        relationship: relationship || null,
        debts: debts.results || [],
      }
    });
  } catch (error) {
    console.error('Error fetching debtor group:', error);
    return c.json(
      { error: { code: 'DATABASE_ERROR', message: 'Failed to fetch debtor group' } },
      500
    );
  }
});

// POST /api/v1/attorney/verify-relationship - Verify debtor-client relationship and approve debt(s)
attorneyRoutes.post('/verify-relationship', async (c) => {
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { debtor_id, client_id, relationship_type, contract_reference, debt_ids, notes } = await c.req.json();
  const db = c.env.DB as D1Database;

  try {
    const now = Date.now();

    // Create or update relationship
    const relationshipId = `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await db
      .prepare(`
        INSERT INTO debtor_client_relationships (
          id, tenant_id, debtor_id, client_id,
          verified, verified_at, verified_by,
          relationship_type, contract_reference,
          trust_level, verification_notes,
          first_debt_date, last_debt_date,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(tenant_id, debtor_id, client_id) DO UPDATE SET
          verified = TRUE,
          verified_at = ?,
          verified_by = ?,
          relationship_type = ?,
          contract_reference = ?,
          trust_level = 'verified',
          verification_notes = ?,
          updated_at = ?
      `)
      .bind(
        relationshipId, tenantId, debtor_id, client_id,
        true, now, userId,
        relationship_type, contract_reference,
        'verified', notes,
        now, now, now, now,
        // ON CONFLICT updates
        now, userId, relationship_type, contract_reference, notes, now
      )
      .run();

    // Approve all specified debts
    for (const debtId of debt_ids) {
      await db
        .prepare(`
          UPDATE debts
          SET status = 'verified', verified_by = ?, verified_at = ?
          WHERE id = ? AND tenant_id = ?
        `)
        .bind(userId, now, debtId, tenantId)
        .run();
    }

    return c.json({
      data: {
        message: 'Relationship verified and debts approved',
        relationship_id: relationshipId,
        approved_debts: debt_ids.length,
      }
    });
  } catch (error) {
    console.error('Error verifying relationship:', error);
    return c.json(
      { error: { code: 'VERIFICATION_ERROR', message: 'Failed to verify relationship' } },
      500
    );
  }
});

// POST /api/v1/attorney/reject-debt - Reject a debt
attorneyRoutes.post('/reject-debt', async (c) => {
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { debt_id, reason } = await c.req.json();
  const db = c.env.DB as D1Database;

  try {
    const now = Date.now();

    await db
      .prepare(`
        UPDATE debts
        SET status = 'rejected', verified_by = ?, verified_at = ?, rejection_reason = ?
        WHERE id = ? AND tenant_id = ?
      `)
      .bind(userId, now, reason, debt_id, tenantId)
      .run();

    // TODO: Send notification to client about rejection

    return c.json({
      data: {
        message: 'Debt rejected',
        debt_id,
      }
    });
  } catch (error) {
    console.error('Error rejecting debt:', error);
    return c.json(
      { error: { code: 'REJECTION_ERROR', message: 'Failed to reject debt' } },
      500
    );
  }
});
