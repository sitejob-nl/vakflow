-- Fix concept invoices missing dates
UPDATE invoices SET issued_at = CURRENT_DATE, due_at = CURRENT_DATE + 30 
  WHERE status = 'concept' AND issued_at IS NULL;

-- Fix wrong invoice number
UPDATE invoices SET invoice_number = 'F-2026-005' 
  WHERE invoice_number = 'O-2026-003';