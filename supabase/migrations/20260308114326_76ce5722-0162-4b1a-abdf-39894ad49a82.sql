ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_work_orders_quote_id ON work_orders(quote_id);
CREATE INDEX IF NOT EXISTS idx_invoices_quote_id ON invoices(quote_id);