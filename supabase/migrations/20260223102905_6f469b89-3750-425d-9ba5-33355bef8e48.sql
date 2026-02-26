-- Add items and optional_items JSON columns to invoices (matching quotes structure)
ALTER TABLE public.invoices 
ADD COLUMN items jsonb NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN optional_items jsonb NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN notes text;