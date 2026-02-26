ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS notes jsonb DEFAULT '[]'::jsonb;