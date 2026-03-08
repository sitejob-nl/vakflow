-- Data fix: normalize invoice status 'verstuurd' to 'verzonden'
UPDATE invoices SET status = 'verzonden' WHERE status = 'verstuurd';