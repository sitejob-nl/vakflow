-- Portal users can view their own vehicles
CREATE POLICY "Portal users can view own vehicles"
ON public.vehicles
FOR SELECT
TO authenticated
USING (
  customer_id = (SELECT get_portal_customer_id())
);

-- Portal users can view tire storage for their own vehicles
CREATE POLICY "Portal users can view own tire_storage"
ON public.tire_storage
FOR SELECT
TO authenticated
USING (
  vehicle_id IN (
    SELECT id FROM public.vehicles WHERE customer_id = (SELECT get_portal_customer_id())
  )
);