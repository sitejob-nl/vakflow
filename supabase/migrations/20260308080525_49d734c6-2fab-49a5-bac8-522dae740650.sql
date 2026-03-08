
-- Fix the overly permissive INSERT policy — only allow service role (which bypasses RLS anyway)
-- Drop the permissive policy and replace with a proper one
DROP POLICY "Service role can insert apk_reminder_logs" ON public.apk_reminder_logs;

CREATE POLICY "Company users can insert apk_reminder_logs"
  ON public.apk_reminder_logs FOR INSERT
  WITH CHECK (company_id = (SELECT get_my_company_id()) OR (SELECT is_super_admin()));
