
-- SnelStart B2B API v2 integratie tabellen

-- Verbindingen-tabel
CREATE TABLE public.snelstart_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_key TEXT NOT NULL,
  subscription_key TEXT NOT NULL,
  access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id)
);

ALTER TABLE public.snelstart_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company admins can manage snelstart connections" ON public.snelstart_connections
  FOR ALL TO authenticated
  USING (
    company_id = (SELECT get_my_company_id())
    AND has_role((SELECT auth.uid()), 'admin'::app_role)
  )
  WITH CHECK (
    company_id = (SELECT get_my_company_id())
    AND has_role((SELECT auth.uid()), 'admin'::app_role)
  );

CREATE POLICY "Company members can view snelstart connections" ON public.snelstart_connections
  FOR SELECT TO authenticated
  USING (company_id = (SELECT get_my_company_id()));

-- Relaties
CREATE TABLE public.snelstart_relaties (
  id UUID PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES public.snelstart_connections(id) ON DELETE CASCADE,
  relatiecode INTEGER,
  naam TEXT,
  relatiesoort TEXT[],
  email TEXT,
  telefoon TEXT,
  mobiele_telefoon TEXT,
  website_url TEXT,
  btw_nummer TEXT,
  kvk_nummer TEXT,
  iban TEXT,
  vestigings_adres JSONB,
  correspondentie_adres JSONB,
  factuurkorting NUMERIC,
  krediettermijn INTEGER,
  non_actief BOOLEAN DEFAULT FALSE,
  modified_on TIMESTAMPTZ,
  raw_data JSONB,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.snelstart_relaties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members see own relaties" ON public.snelstart_relaties
  FOR SELECT TO authenticated
  USING (connection_id IN (
    SELECT id FROM public.snelstart_connections WHERE company_id = (SELECT get_my_company_id())
  ));

-- Artikelen
CREATE TABLE public.snelstart_artikelen (
  id UUID PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES public.snelstart_connections(id) ON DELETE CASCADE,
  artikelcode TEXT,
  omschrijving TEXT,
  verkoopprijs NUMERIC,
  inkoopprijs NUMERIC,
  eenheid TEXT,
  is_hoofdartikel BOOLEAN,
  is_non_actief BOOLEAN DEFAULT FALSE,
  voorraad_controle BOOLEAN DEFAULT FALSE,
  technische_voorraad NUMERIC,
  vrije_voorraad NUMERIC,
  artikel_omzetgroep_id UUID,
  modified_on TIMESTAMPTZ,
  raw_data JSONB,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.snelstart_artikelen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members see own artikelen" ON public.snelstart_artikelen
  FOR SELECT TO authenticated
  USING (connection_id IN (
    SELECT id FROM public.snelstart_connections WHERE company_id = (SELECT get_my_company_id())
  ));

-- Verkoopfacturen
CREATE TABLE public.snelstart_verkoopfacturen (
  id UUID PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES public.snelstart_connections(id) ON DELETE CASCADE,
  factuurnummer TEXT,
  factuur_datum TIMESTAMPTZ,
  verval_datum TIMESTAMPTZ,
  factuur_bedrag NUMERIC,
  openstaand_saldo NUMERIC,
  relatie_id UUID,
  verkoop_boeking_id UUID,
  modified_on TIMESTAMPTZ,
  raw_data JSONB,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.snelstart_verkoopfacturen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members see own verkoopfacturen" ON public.snelstart_verkoopfacturen
  FOR SELECT TO authenticated
  USING (connection_id IN (
    SELECT id FROM public.snelstart_connections WHERE company_id = (SELECT get_my_company_id())
  ));

-- Verkooporders
CREATE TABLE public.snelstart_verkooporders (
  id UUID PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES public.snelstart_connections(id) ON DELETE CASCADE,
  nummer INTEGER,
  datum TIMESTAMPTZ,
  omschrijving TEXT,
  proces_status TEXT,
  verkoop_order_status TEXT,
  relatie_id UUID,
  totaal_exclusief_btw NUMERIC,
  totaal_inclusief_btw NUMERIC,
  modified_on TIMESTAMPTZ,
  raw_data JSONB,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.snelstart_verkooporders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members see own verkooporders" ON public.snelstart_verkooporders
  FOR SELECT TO authenticated
  USING (connection_id IN (
    SELECT id FROM public.snelstart_connections WHERE company_id = (SELECT get_my_company_id())
  ));

-- Offertes
CREATE TABLE public.snelstart_offertes (
  id UUID PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES public.snelstart_connections(id) ON DELETE CASCADE,
  nummer INTEGER,
  datum TIMESTAMPTZ,
  omschrijving TEXT,
  proces_status TEXT,
  relatie_id UUID,
  totaal_exclusief_btw NUMERIC,
  totaal_inclusief_btw NUMERIC,
  modified_on TIMESTAMPTZ,
  raw_data JSONB,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.snelstart_offertes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members see own offertes" ON public.snelstart_offertes
  FOR SELECT TO authenticated
  USING (connection_id IN (
    SELECT id FROM public.snelstart_connections WHERE company_id = (SELECT get_my_company_id())
  ));

-- Sync status
CREATE TABLE public.snelstart_sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.snelstart_connections(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  last_sync_at TIMESTAMPTZ,
  last_modified_filter TIMESTAMPTZ,
  total_synced INTEGER DEFAULT 0,
  status TEXT DEFAULT 'idle',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(connection_id, resource_type)
);

ALTER TABLE public.snelstart_sync_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members see own sync status" ON public.snelstart_sync_status
  FOR SELECT TO authenticated
  USING (connection_id IN (
    SELECT id FROM public.snelstart_connections WHERE company_id = (SELECT get_my_company_id())
  ));
