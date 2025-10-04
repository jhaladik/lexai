-- Migration: Add portal tokens for debtor access
-- Created: 2025-01-04

-- Create portal_tokens table for secure debtor access
CREATE TABLE portal_tokens (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  debt_id TEXT NOT NULL REFERENCES debts(id),

  token TEXT NOT NULL UNIQUE,

  -- Tracking
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_accessed_at INTEGER,
  access_count INTEGER DEFAULT 0,

  -- Status
  revoked BOOLEAN DEFAULT FALSE,
  revoked_at INTEGER,
  revoked_reason TEXT
);

-- Add notification tracking to debts
ALTER TABLE debts ADD COLUMN notification_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE debts ADD COLUMN notification_sent_at INTEGER;
ALTER TABLE debts ADD COLUMN portal_token_id TEXT;

-- Create index for token lookup
CREATE INDEX idx_portal_tokens_token ON portal_tokens(token);
CREATE INDEX idx_portal_tokens_debt ON portal_tokens(debt_id);
CREATE INDEX idx_portal_tokens_expires ON portal_tokens(expires_at);
