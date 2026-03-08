
-- P2: NOT NULL on 4 tables (clean up any existing NULLs first)
DELETE FROM communication_logs WHERE company_id IS NULL;
DELETE FROM notifications WHERE company_id IS NULL;
DELETE FROM whatsapp_messages WHERE company_id IS NULL;
DELETE FROM time_entries WHERE company_id IS NULL;

ALTER TABLE communication_logs ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE notifications ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE whatsapp_messages ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE time_entries ALTER COLUMN company_id SET NOT NULL;

-- P3: enabled_features default uitbreiden
ALTER TABLE companies ALTER COLUMN enabled_features
SET DEFAULT ARRAY['dashboard','planning','customers','workorders',
'invoices','quotes','reports','email','whatsapp','communication',
'reminders','assets','marketing','contracts','schedule','audits',
'vehicles','trade'];

-- P7: FK indexes
CREATE INDEX IF NOT EXISTS idx_communication_logs_customer_id ON communication_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_communication_logs_company_id ON communication_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_communication_logs_work_order_id ON communication_logs(work_order_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_company_id ON notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_customer_id ON whatsapp_messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_company_id ON whatsapp_messages(company_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_work_order_id ON time_entries(work_order_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_company_id ON time_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_contracts_customer_id ON contracts(customer_id);
CREATE INDEX IF NOT EXISTS idx_contracts_company_id ON contracts(company_id);
CREATE INDEX IF NOT EXISTS idx_trade_vehicles_work_order_id ON trade_vehicles(work_order_id);
CREATE INDEX IF NOT EXISTS idx_trade_vehicles_company_id ON trade_vehicles(company_id);
CREATE INDEX IF NOT EXISTS idx_addresses_customer_id ON addresses(customer_id);
CREATE INDEX IF NOT EXISTS idx_asset_maintenance_logs_asset_id ON asset_maintenance_logs(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_maintenance_logs_company_id ON asset_maintenance_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_auto_message_settings_company_id ON auto_message_settings(company_id);
CREATE INDEX IF NOT EXISTS idx_automation_send_log_company_id ON automation_send_log(company_id);
CREATE INDEX IF NOT EXISTS idx_automation_send_log_customer_id ON automation_send_log(customer_id);
CREATE INDEX IF NOT EXISTS idx_work_order_materials_work_order_id ON work_order_materials(work_order_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_mileage_logs_vehicle_id ON vehicle_mileage_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_quotes_customer_id ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_company_id ON quotes(company_id);
CREATE INDEX IF NOT EXISTS idx_quality_audits_asset_id ON quality_audits(asset_id);
CREATE INDEX IF NOT EXISTS idx_quality_audits_company_id ON quality_audits(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_room_scores_audit_id ON audit_room_scores(audit_id);
CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_company_id ON todos(company_id);
