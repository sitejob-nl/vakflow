
-- INVOICES: Replace broad authenticated policies with admin-only
DROP POLICY IF EXISTS "Authenticated users can view invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated users can insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated users can update invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated users can delete invoices" ON public.invoices;

CREATE POLICY "Admins can view invoices"
ON public.invoices FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert invoices"
ON public.invoices FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update invoices"
ON public.invoices FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete invoices"
ON public.invoices FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- COMMUNICATION_LOGS: Replace broad authenticated policies with admin-only
DROP POLICY IF EXISTS "Authenticated users can view communication_logs" ON public.communication_logs;
DROP POLICY IF EXISTS "Authenticated users can insert communication_logs" ON public.communication_logs;
DROP POLICY IF EXISTS "Authenticated users can update communication_logs" ON public.communication_logs;
DROP POLICY IF EXISTS "Authenticated users can delete communication_logs" ON public.communication_logs;

CREATE POLICY "Admins can view communication_logs"
ON public.communication_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert communication_logs"
ON public.communication_logs FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update communication_logs"
ON public.communication_logs FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete communication_logs"
ON public.communication_logs FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
