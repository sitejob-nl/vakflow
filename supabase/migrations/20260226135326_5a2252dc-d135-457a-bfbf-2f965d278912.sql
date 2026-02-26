
-- Drop the overly permissive "manage" policy that allows all authenticated users to write
DROP POLICY IF EXISTS "Authenticated users can manage services" ON public.services;

-- Add admin-only write policies using the existing has_role function
CREATE POLICY "Admins can insert services"
ON public.services
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update services"
ON public.services
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete services"
ON public.services
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
