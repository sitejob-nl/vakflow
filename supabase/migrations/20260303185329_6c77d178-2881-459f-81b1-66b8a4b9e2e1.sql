-- Add 'marketing' to enabled_features for all existing companies that don't have it yet
UPDATE public.companies
SET enabled_features = array_append(enabled_features, 'marketing')
WHERE NOT ('marketing' = ANY(enabled_features));