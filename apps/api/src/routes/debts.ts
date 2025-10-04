import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';

export const debtRoutes = new Hono();

// All routes require authentication
debtRoutes.use('*', requireAuth);

// GET /api/v1/debts - List all debts
debtRoutes.get('/', async (c) => {
  const tenantId = c.get('tenantId');
  const userRole = c.get('userRole');
  const userId = c.get('userId');
  const db = c.env.DB as D1Database;

  try {
    // Build query based on role
    let query = `
      SELECT
        d.*,
        c.company_name as client_company,
        dt.type as debtor_type,
        dt.first_name as debtor_first_name,
        dt.last_name as debtor_last_name,
        dt.company_name as debtor_company
      FROM debts d
      LEFT JOIN clients c ON d.client_id = c.id
      LEFT JOIN debtors dt ON d.debtor_id = dt.id
      WHERE d.tenant_id = ?
    `;

    // If client role, only show their debts
    if (userRole === 'client') {
      const client = await db
        .prepare(`SELECT id FROM clients WHERE user_id = ? AND tenant_id = ?`)
        .bind(userId, tenantId)
        .first();

      if (client) {
        query += ` AND d.client_id = '${client.id}'`;
      }
    }

    query += ` ORDER BY d.created_at DESC`;

    const result = await db.prepare(query).bind(tenantId).all();

    return c.json({ data: result.results || [] });
  } catch (error) {
    console.error('Error listing debts:', error);
    return c.json(
      { error: { code: 'DATABASE_ERROR', message: 'Failed to fetch debts' } },
      500
    );
  }
});

// POST /api/v1/debts - Create new debt
debtRoutes.post('/', async (c) => {
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const db = c.env.DB as D1Database;

  try {
    const body = await c.req.json();

    // Generate IDs
    const debtId = `debt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    // Validate required fields
    if (!body.client_id || !body.debtor_id || !body.debt_type || !body.original_amount) {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } },
        400
      );
    }

    // Create debtor if needed (new debtor data provided)
    let debtorId = body.debtor_id;
    if (body.debtor_id === 'new' && body.debtor) {
      debtorId = `debtor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await db
        .prepare(`
          INSERT INTO debtors (
            id, tenant_id, type, first_name, last_name, company_name,
            registration_number, email, phone, address, city, postal_code,
            country, created_by, source, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          debtorId,
          tenantId,
          body.debtor.type,
          body.debtor.first_name || null,
          body.debtor.last_name || null,
          body.debtor.company_name || null,
          body.debtor.registration_number || null,
          body.debtor.email || null,
          body.debtor.phone || null,
          body.debtor.address || null,
          body.debtor.city || null,
          body.debtor.postal_code || null,
          body.debtor.country || 'CZ',
          userId,
          'manual',
          now
        )
        .run();
    }

    // Check if relationship is already verified (auto-approve logic)
    const relationship = await db
      .prepare(`
        SELECT verified, trust_level FROM debtor_client_relationships
        WHERE tenant_id = ? AND debtor_id = ? AND client_id = ? AND verified = TRUE
      `)
      .bind(tenantId, debtorId, body.client_id)
      .first();

    // Auto-approve if relationship is verified, otherwise pending verification
    const initialStatus = relationship ? 'verified' : 'pending_verification';

    // Create debt
    await db
      .prepare(`
        INSERT INTO debts (
          id, tenant_id, client_id, debtor_id, reference_number, debt_type,
          original_amount, current_amount, currency, invoice_date, due_date,
          status, verification_status, has_contract, has_invoice,
          has_delivery_proof, has_communication_log, notes, created_by, source, created_at,
          verified_at, verified_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        debtId,
        tenantId,
        body.client_id,
        debtorId,
        body.reference_number || null,
        body.debt_type,
        body.original_amount,
        body.original_amount, // current_amount starts same as original
        body.currency || 'CZK',
        body.invoice_date ? new Date(body.invoice_date).getTime() : now,
        body.due_date ? new Date(body.due_date).getTime() : now,
        initialStatus,
        'pending',
        body.has_contract || false,
        body.has_invoice || false,
        body.has_delivery_proof || false,
        body.has_communication_log || false,
        body.notes || null,
        userId,
        'manual',
        now,
        relationship ? now : null,
        relationship ? 'system_auto_approved' : null
      )
      .run();

    // Update relationship debt counts if exists
    if (relationship) {
      await db
        .prepare(`
          UPDATE debtor_client_relationships
          SET total_debts_count = total_debts_count + 1,
              last_debt_date = ?,
              updated_at = ?
          WHERE tenant_id = ? AND debtor_id = ? AND client_id = ?
        `)
        .bind(now, now, tenantId, debtorId, body.client_id)
        .run();
    }

    // Fetch the created debt with joined data
    const debt = await db
      .prepare(`
        SELECT
          d.*,
          c.company_name as client_company,
          dt.type as debtor_type,
          dt.first_name as debtor_first_name,
          dt.last_name as debtor_last_name,
          dt.company_name as debtor_company
        FROM debts d
        LEFT JOIN clients c ON d.client_id = c.id
        LEFT JOIN debtors dt ON d.debtor_id = dt.id
        WHERE d.id = ?
      `)
      .bind(debtId)
      .first();

    return c.json({ data: debt }, 201);
  } catch (error) {
    console.error('Error creating debt:', error);
    return c.json(
      { error: { code: 'DATABASE_ERROR', message: 'Failed to create debt' } },
      500
    );
  }
});

// GET /api/v1/debts/:id - Get single debt
debtRoutes.get('/:id', async (c) => {
  const tenantId = c.get('tenantId');
  const debtId = c.req.param('id');
  const db = c.env.DB as D1Database;

  try {
    const debt = await db
      .prepare(`
        SELECT
          d.*,
          c.company_name as client_company,
          c.registration_number as client_ico,
          dt.*,
          dt.type as debtor_type,
          dt.first_name as debtor_first_name,
          dt.last_name as debtor_last_name,
          dt.company_name as debtor_company
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

    return c.json({ data: debt });
  } catch (error) {
    console.error('Error fetching debt:', error);
    return c.json(
      { error: { code: 'DATABASE_ERROR', message: 'Failed to fetch debt' } },
      500
    );
  }
});

// PUT /api/v1/debts/:id - Update debt
debtRoutes.put('/:id', async (c) => {
  const tenantId = c.get('tenantId');
  const debtId = c.req.param('id');
  const db = c.env.DB as D1Database;

  try {
    const body = await c.req.json();

    // Check if debt exists and can be edited
    const existingDebt = await db
      .prepare(`SELECT status FROM debts WHERE id = ? AND tenant_id = ?`)
      .bind(debtId, tenantId)
      .first();

    if (!existingDebt) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Debt not found' } },
        404
      );
    }

    // Only allow editing if status is draft or pending_verification
    const editableStatuses = ['draft', 'pending_verification'];
    if (!editableStatuses.includes(existingDebt.status as string)) {
      return c.json(
        { error: { code: 'CANNOT_EDIT', message: 'Cannot edit debt with active process' } },
        400
      );
    }

    // Update debt
    await db
      .prepare(`
        UPDATE debts
        SET
          reference_number = ?,
          debt_type = ?,
          original_amount = ?,
          current_amount = ?,
          currency = ?,
          invoice_date = ?,
          due_date = ?,
          has_contract = ?,
          has_invoice = ?,
          has_delivery_proof = ?,
          has_communication_log = ?,
          notes = ?
        WHERE id = ? AND tenant_id = ?
      `)
      .bind(
        body.reference_number || null,
        body.debt_type,
        body.original_amount,
        body.original_amount, // current_amount matches original when editing
        body.currency || 'CZK',
        body.invoice_date ? new Date(body.invoice_date).getTime() : null,
        body.due_date ? new Date(body.due_date).getTime() : null,
        body.has_contract || false,
        body.has_invoice || false,
        body.has_delivery_proof || false,
        body.has_communication_log || false,
        body.notes || null,
        debtId,
        tenantId
      )
      .run();

    // Fetch updated debt
    const debt = await db
      .prepare(`
        SELECT
          d.*,
          c.company_name as client_company,
          dt.type as debtor_type,
          dt.first_name as debtor_first_name,
          dt.last_name as debtor_last_name,
          dt.company_name as debtor_company
        FROM debts d
        LEFT JOIN clients c ON d.client_id = c.id
        LEFT JOIN debtors dt ON d.debtor_id = dt.id
        WHERE d.id = ? AND d.tenant_id = ?
      `)
      .bind(debtId, tenantId)
      .first();

    return c.json({ data: debt });
  } catch (error) {
    console.error('Error updating debt:', error);
    return c.json(
      { error: { code: 'DATABASE_ERROR', message: 'Failed to update debt' } },
      500
    );
  }
});

// PUT /api/v1/debts/:id/verify - Verify debt (change status to verified)
debtRoutes.put('/:id/verify', async (c) => {
  const tenantId = c.get('tenantId');
  const debtId = c.req.param('id');
  const db = c.env.DB as D1Database;

  try {
    const debt = await db
      .prepare(`SELECT status FROM debts WHERE id = ? AND tenant_id = ?`)
      .bind(debtId, tenantId)
      .first();

    if (!debt) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Debt not found' } }, 404);
    }

    await db
      .prepare(`UPDATE debts SET status = 'verified', verification_status = 'approved' WHERE id = ? AND tenant_id = ?`)
      .bind(debtId, tenantId)
      .run();

    const updatedDebt = await db
      .prepare(`
        SELECT d.*, c.company_name as client_company, dt.type as debtor_type,
        dt.first_name as debtor_first_name, dt.last_name as debtor_last_name, dt.company_name as debtor_company
        FROM debts d
        LEFT JOIN clients c ON d.client_id = c.id
        LEFT JOIN debtors dt ON d.debtor_id = dt.id
        WHERE d.id = ? AND d.tenant_id = ?
      `)
      .bind(debtId, tenantId)
      .first();

    return c.json({ data: updatedDebt });
  } catch (error) {
    console.error('Error verifying debt:', error);
    return c.json({ error: { code: 'DATABASE_ERROR', message: 'Failed to verify debt' } }, 500);
  }
});

// DELETE /api/v1/debts/:id - Delete debt
debtRoutes.delete('/:id', async (c) => {
  const tenantId = c.get('tenantId');
  const debtId = c.req.param('id');
  const db = c.env.DB as D1Database;

  try {
    // Check if debt exists and can be deleted
    const debt = await db
      .prepare(`SELECT status FROM debts WHERE id = ? AND tenant_id = ?`)
      .bind(debtId, tenantId)
      .first();

    if (!debt) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Debt not found' } },
        404
      );
    }

    // Only allow deletion if status is draft or pending_verification
    const deletableStatuses = ['draft', 'pending_verification'];
    if (!deletableStatuses.includes(debt.status as string)) {
      return c.json(
        { error: { code: 'CANNOT_DELETE', message: 'Cannot delete debt with active process' } },
        400
      );
    }

    // Delete debt
    await db
      .prepare(`DELETE FROM debts WHERE id = ? AND tenant_id = ?`)
      .bind(debtId, tenantId)
      .run();

    return c.json({ data: { success: true } });
  } catch (error) {
    console.error('Error deleting debt:', error);
    return c.json(
      { error: { code: 'DATABASE_ERROR', message: 'Failed to delete debt' } },
      500
    );
  }
});

// POST /api/v1/debts/bulk-upload
debtRoutes.post('/bulk-upload', async (c) => {
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const userRole = c.get('userRole');
  const db = c.env.DB as D1Database;

  try {
    const body = await c.req.text();
    const lines = body.trim().split('\n');

    if (lines.length < 2) {
      return c.json(
        { error: { code: 'INVALID_CSV', message: 'CSV file is empty or invalid' } },
        400
      );
    }

    // Validate headers
    const headers = lines[0].split(',').map(h => h.trim());
    const requiredHeaders = [
      'debtor_type', 'debt_type', 'amount', 'invoice_date', 'due_date'
    ];

    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      return c.json(
        { error: { code: 'INVALID_HEADERS', message: `Missing required headers: ${missingHeaders.join(', ')}` } },
        400
      );
    }

    // Limit to 500 rows
    const dataRows = lines.slice(1);
    if (dataRows.length > 500) {
      return c.json(
        { error: { code: 'TOO_MANY_ROWS', message: 'Maximum 500 rows allowed per upload' } },
        400
      );
    }

    // Get client_id - admin/attorney can upload for any client, client role uploads for themselves
    let clientId: string | null = null;
    if (userRole === 'client') {
      const client = await db
        .prepare(`SELECT id FROM clients WHERE user_id = ? AND tenant_id = ?`)
        .bind(userId, tenantId)
        .first();
      if (!client) {
        return c.json(
          { error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found for user' } },
          404
        );
      }
      clientId = client.id as string;
    } else if (userRole === 'admin' || userRole === 'attorney') {
      // Admin/attorney must specify client_id in the CSV or we use the first client
      const firstClient = await db
        .prepare(`SELECT id FROM clients WHERE tenant_id = ? LIMIT 1`)
        .bind(tenantId)
        .first();
      if (!firstClient) {
        return c.json(
          { error: { code: 'NO_CLIENTS', message: 'No clients found. Please create a client first.' } },
          404
        );
      }
      clientId = firstClient.id as string;
    } else {
      return c.json(
        { error: { code: 'UNAUTHORIZED', message: 'Insufficient permissions to upload debts' } },
        403
      );
    }

    // Create bulk upload record
    const bulkUploadId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    await db
      .prepare(`
        INSERT INTO bulk_uploads (
          id, tenant_id, uploaded_by, filename, total_rows, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        bulkUploadId,
        tenantId,
        userId,
        'upload.csv',
        dataRows.length,
        'processing',
        now
      )
      .run();

    const results = {
      total: dataRows.length,
      successful: 0,
      flagged: 0,
      failed: 0,
      errors: [] as Array<{ row: number; message: string }>
    };

    // Process each row
    for (let i = 0; i < dataRows.length; i++) {
      const rowNum = i + 2; // +2 because of header and 0-index
      const row = dataRows[i].split(',').map(v => v.trim());

      try {
        const rowData: any = {};
        headers.forEach((header, idx) => {
          rowData[header] = row[idx] || '';
        });

        // Validate required fields
        if (!rowData.debtor_type || !rowData.debt_type || !rowData.amount) {
          results.errors.push({ row: rowNum, message: 'Missing required fields' });
          results.failed++;
          continue;
        }

        // Validate debt type
        const validDebtTypes = ['invoice', 'lease', 'rental', 'service', 'damage', 'other'];
        if (!validDebtTypes.includes(rowData.debt_type)) {
          results.errors.push({ row: rowNum, message: `Invalid debt_type: ${rowData.debt_type}` });
          results.failed++;
          continue;
        }

        // Validate debtor type
        if (!['individual', 'business'].includes(rowData.debtor_type)) {
          results.errors.push({ row: rowNum, message: `Invalid debtor_type: ${rowData.debtor_type}` });
          results.failed++;
          continue;
        }

        // Validate amount is numeric
        const amount = parseFloat(rowData.amount);
        if (isNaN(amount) || amount <= 0) {
          results.errors.push({ row: rowNum, message: 'Amount must be a positive number' });
          results.failed++;
          continue;
        }

        // Check if debtor exists or create new one
        let debtorId: string | null = null;

        // For business, try to find by ICO
        if (rowData.debtor_type === 'business' && rowData.debtor_ico) {
          const existingDebtor = await db
            .prepare(`SELECT id FROM debtors WHERE registration_number = ? AND tenant_id = ?`)
            .bind(rowData.debtor_ico, tenantId)
            .first();

          if (existingDebtor) {
            debtorId = existingDebtor.id as string;
          }
        }

        // For individual, try to find by email
        if (rowData.debtor_type === 'individual' && rowData.debtor_email) {
          const existingDebtor = await db
            .prepare(`SELECT id FROM debtors WHERE email = ? AND type = 'individual' AND tenant_id = ?`)
            .bind(rowData.debtor_email, tenantId)
            .first();

          if (existingDebtor) {
            debtorId = existingDebtor.id as string;
          }
        }

        // Create debtor if not found
        if (!debtorId) {
          debtorId = `debtor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          await db
            .prepare(`
              INSERT INTO debtors (
                id, tenant_id, type, first_name, last_name, company_name,
                registration_number, email, phone, address, city, postal_code,
                country, created_by, source, bulk_upload_id, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .bind(
              debtorId,
              tenantId,
              rowData.debtor_type,
              rowData.debtor_first_name || null,
              rowData.debtor_last_name || null,
              rowData.debtor_company_name || null,
              rowData.debtor_ico || null,
              rowData.debtor_email || null,
              rowData.debtor_phone || null,
              rowData.debtor_address || null,
              rowData.debtor_city || null,
              rowData.debtor_postal_code || null,
              rowData.debtor_country || 'CZ',
              userId,
              'bulk_upload',
              bulkUploadId,
              Date.now()
            )
            .run();
        }

        // Create debt
        const debtId = `debt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = Date.now();

        // Parse dates
        const invoiceDate = rowData.invoice_date ? new Date(rowData.invoice_date).getTime() : now;
        const dueDate = rowData.due_date ? new Date(rowData.due_date).getTime() : now;

        // Check if relationship is already verified (auto-approve logic)
        const relationship = await db
          .prepare(`
            SELECT verified FROM debtor_client_relationships
            WHERE tenant_id = ? AND debtor_id = ? AND client_id = ? AND verified = TRUE
          `)
          .bind(tenantId, debtorId, clientId)
          .first();

        const initialStatus = relationship ? 'verified' : 'pending_verification';

        await db
          .prepare(`
            INSERT INTO debts (
              id, tenant_id, client_id, debtor_id, reference_number, debt_type,
              original_amount, current_amount, currency, invoice_date, due_date,
              status, verification_status, notes, created_by, source, bulk_upload_id, created_at,
              verified_at, verified_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            debtId,
            tenantId,
            clientId,
            debtorId,
            rowData.reference_number || null,
            rowData.debt_type,
            amount,
            amount,
            'CZK',
            invoiceDate,
            dueDate,
            initialStatus,
            'pending',
            rowData.description || null,
            userId,
            'bulk_upload',
            bulkUploadId,
            now,
            relationship ? now : null,
            relationship ? 'system_auto_approved' : null
          )
          .run();

        // Update relationship debt counts if exists
        if (relationship) {
          await db
            .prepare(`
              UPDATE debtor_client_relationships
              SET total_debts_count = total_debts_count + 1,
                  last_debt_date = ?,
                  updated_at = ?
              WHERE tenant_id = ? AND debtor_id = ? AND client_id = ?
            `)
            .bind(now, now, tenantId, debtorId, clientId)
            .run();
        }

        results.successful++;

      } catch (error) {
        console.error(`Error processing row ${rowNum}:`, error);
        results.errors.push({ row: rowNum, message: error instanceof Error ? error.message : 'Unknown error' });
        results.failed++;
      }
    }

    // Update bulk upload record with results
    await db
      .prepare(`
        UPDATE bulk_uploads
        SET successful_rows = ?, failed_rows = ?, status = ?, results = ?, completed_at = ?
        WHERE id = ?
      `)
      .bind(
        results.successful,
        results.failed,
        'completed',
        JSON.stringify(results),
        Date.now(),
        bulkUploadId
      )
      .run();

    return c.json({
      data: {
        message: 'Bulk upload completed',
        bulk_upload_id: bulkUploadId,
        results
      }
    }, 201);

  } catch (error) {
    console.error('Error in bulk upload:', error);
    return c.json(
      { error: { code: 'UPLOAD_ERROR', message: 'Failed to process bulk upload' } },
      500
    );
  }
});

// GET /api/v1/debts/bulk-template
debtRoutes.get('/bulk-template', async (c) => {
  // CSV template with headers and example row
  const template = `debtor_type,debtor_ico,debtor_first_name,debtor_last_name,debtor_company_name,debtor_email,debtor_phone,debtor_address,debtor_city,debtor_postal_code,debtor_country,debt_type,reference_number,amount,invoice_date,due_date,description
business,12345678,,,Example Company s.r.o.,debtor@example.com,+420123456789,Hlavní 123,Praha,11000,CZ,invoice,INV-2025-001,50000,2025-01-15,2025-02-15,Example invoice debt
individual,,Jan,Novák,,jan@example.com,+420987654321,Vedlejší 45,Brno,60200,CZ,rental,RENT-001,15000,2025-01-01,2025-02-01,Monthly rent payment`;

  return new Response(template, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="debt_upload_template.csv"',
    },
  });
});
