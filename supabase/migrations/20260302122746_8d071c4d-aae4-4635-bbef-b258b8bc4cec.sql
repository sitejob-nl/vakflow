
ALTER TABLE public.companies
ADD COLUMN brand_color text DEFAULT NULL;

COMMENT ON COLUMN public.companies.brand_color IS 'Brand color stored as hex (e.g. #4F46E5). Used to override --primary CSS variable for white-labeling.';
