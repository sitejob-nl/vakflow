-- Portal users can view their own appointments
CREATE POLICY "Portal users can view own appointments"
ON public.appointments FOR SELECT TO authenticated
USING (customer_id = (SELECT get_portal_customer_id()));

-- Portal users can insert appointment requests
CREATE POLICY "Portal users can insert appointment requests"
ON public.appointments FOR INSERT TO authenticated
WITH CHECK (
  customer_id = (SELECT get_portal_customer_id())
  AND status = 'aangevraagd'
);