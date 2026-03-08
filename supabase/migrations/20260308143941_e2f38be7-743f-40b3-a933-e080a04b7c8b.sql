ALTER TABLE appointments ADD COLUMN IF NOT EXISTS delivery_type text DEFAULT 'gebracht';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS pickup_address text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS pickup_lat numeric;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS pickup_lng numeric;