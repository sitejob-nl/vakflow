
CREATE OR REPLACE FUNCTION public.get_company_stats()
RETURNS TABLE(company_id uuid, customer_count bigint, user_count bigint, work_order_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id AS company_id,
    (SELECT count(*) FROM customers WHERE customers.company_id = c.id) AS customer_count,
    (SELECT count(*) FROM profiles WHERE profiles.company_id = c.id) AS user_count,
    (SELECT count(*) FROM work_orders WHERE work_orders.company_id = c.id) AS work_order_count
  FROM companies c;
$$;
