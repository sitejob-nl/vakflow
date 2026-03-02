UPDATE public.companies 
SET enabled_features = array_append(enabled_features, 'assets') 
WHERE NOT ('assets' = ANY(enabled_features));