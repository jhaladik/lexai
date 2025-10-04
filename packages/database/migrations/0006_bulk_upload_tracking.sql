-- Migration: Add bulk upload tracking
-- Created: 2025-01-04

-- Add source tracking to debts table
ALTER TABLE debts ADD COLUMN created_by TEXT REFERENCES users(id);
ALTER TABLE debts ADD COLUMN source TEXT DEFAULT 'manual' CHECK(source IN ('manual', 'bulk_upload', 'api'));
ALTER TABLE debts ADD COLUMN bulk_upload_id TEXT;

-- Add source tracking to debtors table
ALTER TABLE debtors ADD COLUMN created_by TEXT REFERENCES users(id);
ALTER TABLE debtors ADD COLUMN source TEXT DEFAULT 'manual' CHECK(source IN ('manual', 'bulk_upload', 'api'));
ALTER TABLE debtors ADD COLUMN bulk_upload_id TEXT;

-- Create bulk_uploads table to track upload sessions
CREATE TABLE bulk_uploads (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  uploaded_by TEXT NOT NULL REFERENCES users(id),

  filename TEXT NOT NULL,
  total_rows INTEGER NOT NULL,
  successful_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,

  status TEXT DEFAULT 'processing' CHECK(status IN ('processing', 'completed', 'failed')),

  results TEXT, -- JSON with detailed results

  created_at INTEGER NOT NULL,
  completed_at INTEGER
);

-- Create index for bulk upload tracking
CREATE INDEX idx_debts_bulk_upload ON debts(bulk_upload_id);
CREATE INDEX idx_debtors_bulk_upload ON debtors(bulk_upload_id);
CREATE INDEX idx_bulk_uploads_tenant ON bulk_uploads(tenant_id);
