CREATE TABLE IF NOT EXISTS evaluations (
  id TEXT PRIMARY KEY,
  school TEXT NOT NULL,
  major TEXT NOT NULL,
  gpa TEXT,
  target_major TEXT NOT NULL,
  region TEXT,
  english_level TEXT,
  result_json TEXT,
  preview_json TEXT,
  is_paid INTEGER DEFAULT 0,
  status TEXT DEFAULT 'created',
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT DEFAULT (datetime('now', '+7 days'))
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  evaluation_id TEXT NOT NULL,
  status TEXT DEFAULT 'created',
  amount REAL DEFAULT 9.9,
  taobao_url TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  paid_at TEXT,
  FOREIGN KEY (evaluation_id) REFERENCES evaluations(id)
);

CREATE TABLE IF NOT EXISTS redeem_codes (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  order_id TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE INDEX IF NOT EXISTS idx_evaluations_status ON evaluations(status);
CREATE INDEX IF NOT EXISTS idx_redeem_codes_code ON redeem_codes(code);
CREATE INDEX IF NOT EXISTS idx_orders_evaluation ON orders(evaluation_id);

-- Migration: payment redesign (2026-07-17)
-- New columns for free-tier + manual review flow

ALTER TABLE evaluations ADD COLUMN free_until TEXT;
ALTER TABLE evaluations ADD COLUMN unlock_type TEXT DEFAULT 'free';

ALTER TABLE orders ADD COLUMN txn_ref TEXT;
ALTER TABLE orders ADD COLUMN device_id TEXT;
ALTER TABLE orders ADD COLUMN reviewed_by TEXT;
ALTER TABLE orders ADD COLUMN reviewed_at TEXT;
ALTER TABLE orders ADD COLUMN notes TEXT;
