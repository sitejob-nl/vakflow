
ALTER TABLE public.companies 
ALTER COLUMN enabled_features 
SET DEFAULT ARRAY['dashboard','planning','customers','workorders','invoices','quotes','reports','email','whatsapp','communication','reminders','assets'];

UPDATE public.companies 
SET enabled_features = array_append(enabled_features, 'reports') 
WHERE NOT ('reports' = ANY(enabled_features));
