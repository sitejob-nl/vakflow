
-- ============================================================
-- P0 FIX 1: Prevent company_id mutation on profiles (tenant takeover)
-- ============================================================

-- Drop the old UPDATE policy
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- New UPDATE policy: users can only update their own profile AND cannot change company_id
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()) AND company_id IS NOT DISTINCT FROM (SELECT get_my_company_id()));

-- ============================================================
-- P0 FIX 2: Prevent admins from granting super_admin role
-- ============================================================

DROP POLICY IF EXISTS "Company admins can insert roles" ON public.user_roles;
CREATE POLICY "Company admins can insert roles"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = (SELECT get_my_company_id())
    AND has_role((SELECT auth.uid()), 'admin'::app_role)
    AND role <> 'super_admin'::app_role
  );

DROP POLICY IF EXISTS "Company admins can update roles" ON public.user_roles;
CREATE POLICY "Company admins can update roles"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (
    company_id = (SELECT get_my_company_id())
    AND has_role((SELECT auth.uid()), 'admin'::app_role)
  )
  WITH CHECK (
    company_id = (SELECT get_my_company_id())
    AND has_role((SELECT auth.uid()), 'admin'::app_role)
    AND role <> 'super_admin'::app_role
  );

DROP POLICY IF EXISTS "Company admins can delete roles" ON public.user_roles;
CREATE POLICY "Company admins can delete roles"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (
    company_id = (SELECT get_my_company_id())
    AND has_role((SELECT auth.uid()), 'admin'::app_role)
    AND role <> 'super_admin'::app_role
  );

-- ============================================================
-- P0 FIX 3: Update has_role() to be company-scoped (defense in depth)
-- ============================================================

-- Create company-scoped overload
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND company_id = _company_id
  )
$$;

-- ============================================================
-- P0 FIX 4: Lock companies_safe view — recreate as SECURITY INVOKER
-- ============================================================

DROP VIEW IF EXISTS public.companies_safe;
CREATE VIEW public.companies_safe
WITH (security_invoker = true)
AS
SELECT
  id, name, max_users, created_at, smtp_port,
  eboekhouden_ledger_id, eboekhouden_template_id, eboekhouden_debtor_ledger_id,
  slug, address, city, postal_code, phone,
  kvk_number, btw_number, iban, logo_url, brand_color,
  industry, subcategory, enabled_features,
  accounting_provider, email_provider,
  outlook_email, outlook_client_id, outlook_tenant_id,
  smtp_email, smtp_host, custom_domain,
  rompslomp_company_id, rompslomp_company_name, rompslomp_tenant_id,
  moneybird_administration_id,
  pwa_name, pwa_icon_url,
  sync_invoices_to_accounting, sync_quotes_to_accounting,
  (eboekhouden_api_token IS NOT NULL AND eboekhouden_api_token <> '') AS has_eboekhouden_token,
  (wefact_api_key IS NOT NULL AND wefact_api_key <> '') AS has_wefact_key
FROM public.companies;

-- ============================================================
-- P1 FIX 1: Enable RLS on rdw_defect_descriptions
-- ============================================================

ALTER TABLE public.rdw_defect_descriptions ENABLE ROW LEVEL SECURITY;

-- Public reference data — allow authenticated read
CREATE POLICY "Authenticated users can read defect descriptions"
  ON public.rdw_defect_descriptions
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- P1 FIX 2: Fix search_path on remaining function
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_vehicle_mileage_on_wo_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF NEW.status = 'afgerond' AND OLD.status IS DISTINCT FROM 'afgerond'
     AND NEW.vehicle_id IS NOT NULL AND NEW.mileage_end IS NOT NULL THEN
    UPDATE public.vehicles
    SET mileage_current = NEW.mileage_end
    WHERE id = NEW.vehicle_id;

    INSERT INTO public.vehicle_mileage_logs (vehicle_id, company_id, mileage, work_order_id, recorded_at)
    VALUES (NEW.vehicle_id, NEW.company_id, NEW.mileage_end, NEW.id, now());
  END IF;
  RETURN NEW;
END;
$function$;
