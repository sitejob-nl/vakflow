DROP INDEX IF EXISTS idx_whatsapp_config_phone_number_id;
CREATE UNIQUE INDEX idx_whatsapp_config_phone_number_id 
  ON whatsapp_config (phone_number_id) 
  WHERE phone_number_id IS NOT NULL AND phone_number_id != 'pending';