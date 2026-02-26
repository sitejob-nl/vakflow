
-- Create addresses table for multi-property support
CREATE TABLE public.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  street text,
  house_number text,
  apartment text,
  postal_code text,
  city text,
  notes text,
  last_service_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view addresses"
ON public.addresses FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert addresses"
ON public.addresses FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update addresses"
ON public.addresses FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete addresses"
ON public.addresses FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Add optional address_id to work_orders and appointments
ALTER TABLE public.work_orders ADD COLUMN address_id uuid REFERENCES public.addresses(id) ON DELETE SET NULL;
ALTER TABLE public.appointments ADD COLUMN address_id uuid REFERENCES public.addresses(id) ON DELETE SET NULL;
