INSERT INTO exact_config (company_id, tenant_id, webhook_secret, division, company_name_exact, status)
SELECT company_id, tenant_id::uuid, webhook_secret, exact_division, company_name, 'connected'
FROM exact_online_connections
WHERE is_active = true
  AND company_id NOT IN (SELECT company_id FROM exact_config)
ON CONFLICT DO NOTHING;