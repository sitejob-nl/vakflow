ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS share_token text UNIQUE;
CREATE INDEX IF NOT EXISTS idx_work_orders_share_token ON work_orders(share_token);