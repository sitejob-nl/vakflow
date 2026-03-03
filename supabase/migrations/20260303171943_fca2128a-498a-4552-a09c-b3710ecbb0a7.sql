ALTER TABLE communication_logs
  ADD COLUMN IF NOT EXISTS folder_name text DEFAULT 'inbox';