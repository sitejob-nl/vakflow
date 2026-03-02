
ALTER TABLE public.companies 
ALTER COLUMN enabled_features 
SET DEFAULT ARRAY['dashboard','planning','customers','workorders','invoices','quotes','email','whatsapp','communication','reminders','assets'];
