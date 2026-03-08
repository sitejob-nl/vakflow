ALTER TABLE materials
  ADD COLUMN cost_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN markup_percentage numeric NOT NULL DEFAULT 0;