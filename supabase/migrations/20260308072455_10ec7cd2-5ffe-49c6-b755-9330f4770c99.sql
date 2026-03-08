
-- Portal users: links Supabase auth users to customers for portal access
CREATE TABLE public.portal_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(customer_id)
);

ALTER TABLE public.portal_users ENABLE ROW LEVEL SECURITY;

-- Portal users can read their own record
CREATE POLICY "Portal users can view own record"
  ON public.portal_users FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

-- Admins can select portal users for their company
CREATE POLICY "Admins can view portal users"
  ON public.portal_users FOR SELECT TO authenticated
  USING (
    (company_id = (SELECT get_my_company_id()) AND has_role((SELECT auth.uid()), 'admin'))
    OR (SELECT is_super_admin())
  );

-- Admins can insert portal users
CREATE POLICY "Admins can insert portal users"
  ON public.portal_users FOR INSERT TO authenticated
  WITH CHECK (
    (company_id = (SELECT get_my_company_id()) AND has_role((SELECT auth.uid()), 'admin'))
    OR (SELECT is_super_admin())
  );

-- Admins can update portal users
CREATE POLICY "Admins can update portal users"
  ON public.portal_users FOR UPDATE TO authenticated
  USING (
    (company_id = (SELECT get_my_company_id()) AND has_role((SELECT auth.uid()), 'admin'))
    OR (SELECT is_super_admin())
  );

-- Admins can delete portal users
CREATE POLICY "Admins can delete portal users"
  ON public.portal_users FOR DELETE TO authenticated
  USING (
    (company_id = (SELECT get_my_company_id()) AND has_role((SELECT auth.uid()), 'admin'))
    OR (SELECT is_super_admin())
  );

-- Quote responses table
CREATE TABLE public.quote_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  status text NOT NULL DEFAULT 'goedgekeurd',
  signature_data text,
  notes text,
  responded_by uuid REFERENCES auth.users(id),
  responded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_responses ENABLE ROW LEVEL SECURITY;

-- Portal users can insert responses for their own quotes
CREATE POLICY "Portal users can insert own responses"
  ON public.quote_responses FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = (SELECT pu.customer_id FROM public.portal_users pu WHERE pu.id = (SELECT auth.uid()))
  );

-- Portal users + company users can view responses
CREATE POLICY "Users can view quote responses"
  ON public.quote_responses FOR SELECT TO authenticated
  USING (
    customer_id = (SELECT pu.customer_id FROM public.portal_users pu WHERE pu.id = (SELECT auth.uid()))
    OR company_id = (SELECT get_my_company_id())
    OR (SELECT is_super_admin())
  );

-- Security definer functions
CREATE OR REPLACE FUNCTION public.get_portal_customer_id()
  RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT customer_id FROM public.portal_users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_portal_user()
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.portal_users WHERE id = auth.uid())
$$;

-- Portal users can view their own quotes
CREATE POLICY "Portal users can view own quotes"
  ON public.quotes FOR SELECT TO authenticated
  USING (customer_id = (SELECT get_portal_customer_id()));

-- Portal users can view their own work orders
CREATE POLICY "Portal users can view own work orders"
  ON public.work_orders FOR SELECT TO authenticated
  USING (customer_id = (SELECT get_portal_customer_id()));

-- Portal users can view their own customer record
CREATE POLICY "Portal users can view own customer"
  ON public.customers FOR SELECT TO authenticated
  USING (id = (SELECT get_portal_customer_id()));

-- Portal users can view services (for display)
CREATE POLICY "Portal users can view services"
  ON public.services FOR SELECT TO authenticated
  USING ((SELECT is_portal_user()));
