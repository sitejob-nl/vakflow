
ALTER TABLE public.services ADD COLUMN category text;
ALTER TABLE public.services ADD COLUMN checklist_template jsonb DEFAULT '[]'::jsonb;
