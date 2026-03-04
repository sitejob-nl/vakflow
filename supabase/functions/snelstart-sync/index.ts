import { jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { getConnectionForCompany, snelstartGetAll, delay, type SnelstartConnection } from "../_shared/snelstart-client.ts";

const RESOURCE_TYPES = ["relaties", "artikelen", "verkoopfacturen", "verkooporders", "offertes"] as const;
type ResourceType = typeof RESOURCE_TYPES[number];

const TABLE_MAP: Record<ResourceType, string> = {
  relaties: "snelstart_relaties",
  artikelen: "snelstart_artikelen",
  verkoopfacturen: "snelstart_verkoopfacturen",
  verkooporders: "snelstart_verkooporders",
  offertes: "snelstart_offertes",
};

const ENDPOINT_MAP: Record<ResourceType, string> = {
  relaties: "/relaties",
  artikelen: "/artikelen",
  verkoopfacturen: "/verkoopfacturen",
  verkooporders: "/verkooporders",
  offertes: "/offertes",
};

function mapRelatie(item: any, connectionId: string) {
  return {
    id: item.id,
    connection_id: connectionId,
    relatiecode: item.relatiecode ?? null,
    naam: item.naam ?? null,
    relatiesoort: item.relatiesoort ?? [],
    email: item.email ?? null,
    telefoon: item.telefoon ?? null,
    mobiele_telefoon: item.mobieleTelefoon ?? null,
    website_url: item.websiteUrl ?? null,
    btw_nummer: item.btwNummer ?? null,
    kvk_nummer: item.kvkNummer ?? null,
    iban: item.iban ?? null,
    vestigings_adres: item.vestigingsAdres ?? null,
    correspondentie_adres: item.correspondentieAdres ?? null,
    factuurkorting: item.factuurkorting ?? null,
    krediettermijn: item.krediettermijn ?? null,
    non_actief: item.nonActief ?? false,
    modified_on: item.modifiedOn ?? null,
    raw_data: item,
    synced_at: new Date().toISOString(),
  };
}

function mapArtikel(item: any, connectionId: string) {
  return {
    id: item.id,
    connection_id: connectionId,
    artikelcode: item.artikelcode ?? null,
    omschrijving: item.omschrijving ?? null,
    verkoopprijs: item.verkoopprijs ?? null,
    inkoopprijs: item.inkoopprijs ?? null,
    eenheid: item.eenheid ?? null,
    is_hoofdartikel: item.isHoofdartikel ?? null,
    is_non_actief: item.isNonActief ?? false,
    voorraad_controle: item.voorraadControle ?? false,
    technische_voorraad: item.technischeVoorraad ?? null,
    vrije_voorraad: item.vrijeVoorraad ?? null,
    artikel_omzetgroep_id: item.artikelOmzetgroep?.id ?? null,
    modified_on: item.modifiedOn ?? null,
    raw_data: item,
    synced_at: new Date().toISOString(),
  };
}

function mapVerkoopfactuur(item: any, connectionId: string) {
  return {
    id: item.id,
    connection_id: connectionId,
    factuurnummer: item.factuurnummer ?? null,
    factuur_datum: item.factuurDatum ?? null,
    verval_datum: item.vervalDatum ?? null,
    factuur_bedrag: item.factuurBedrag ?? null,
    openstaand_saldo: item.openstaandSaldo ?? null,
    relatie_id: item.relatie?.id ?? null,
    verkoop_boeking_id: item.verkoopBoeking?.id ?? null,
    modified_on: item.modifiedOn ?? null,
    raw_data: item,
    synced_at: new Date().toISOString(),
  };
}

function mapVerkooporder(item: any, connectionId: string) {
  return {
    id: item.id,
    connection_id: connectionId,
    nummer: item.nummer ?? null,
    datum: item.datum ?? null,
    omschrijving: item.omschrijving ?? null,
    proces_status: item.procesStatus ?? null,
    verkoop_order_status: item.verkooporderStatus ?? null,
    relatie_id: item.relatie?.id ?? null,
    totaal_exclusief_btw: item.totaalExclusiefBtw ?? null,
    totaal_inclusief_btw: item.totaalInclusiefBtw ?? null,
    modified_on: item.modifiedOn ?? null,
    raw_data: item,
    synced_at: new Date().toISOString(),
  };
}

function mapOfferte(item: any, connectionId: string) {
  return {
    id: item.id,
    connection_id: connectionId,
    nummer: item.nummer ?? null,
    datum: item.datum ?? null,
    omschrijving: item.omschrijving ?? null,
    proces_status: item.procesStatus ?? null,
    relatie_id: item.relatie?.id ?? null,
    totaal_exclusief_btw: item.totaalExclusiefBtw ?? null,
    totaal_inclusief_btw: item.totaalInclusiefBtw ?? null,
    modified_on: item.modifiedOn ?? null,
    raw_data: item,
    synced_at: new Date().toISOString(),
  };
}

const MAPPERS: Record<ResourceType, (item: any, connId: string) => any> = {
  relaties: mapRelatie,
  artikelen: mapArtikel,
  verkoopfacturen: mapVerkoopfactuur,
  verkooporders: mapVerkooporder,
  offertes: mapOfferte,
};

async function syncResource(
  admin: any,
  conn: SnelstartConnection,
  resourceType: ResourceType,
  syncType: "delta" | "full"
) {
  const table = TABLE_MAP[resourceType];
  const endpoint = ENDPOINT_MAP[resourceType];
  const mapper = MAPPERS[resourceType];

  // Get last sync info for delta
  let filter: string | undefined;
  if (syncType === "delta") {
    const { data: syncStatus } = await admin
      .from("snelstart_sync_status")
      .select("last_modified_filter")
      .eq("connection_id", conn.id)
      .eq("resource_type", resourceType)
      .maybeSingle();

    if (syncStatus?.last_modified_filter) {
      const dt = new Date(syncStatus.last_modified_filter).toISOString().replace("Z", "");
      filter = `modifiedOn gt datetime'${dt}'`;
    }
  }

  // Update status to syncing
  await admin.from("snelstart_sync_status").upsert(
    {
      connection_id: conn.id,
      resource_type: resourceType,
      status: "syncing",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "connection_id,resource_type" }
  );

  const items = await snelstartGetAll(admin, conn, endpoint, filter);
  const rows = items.map((item: any) => mapper(item, conn.id));

  // Upsert in batches of 100
  let totalUpserted = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await admin.from(table).upsert(batch, { onConflict: "id" });
    if (error) {
      console.error(`Upsert error for ${resourceType}:`, error);
      throw error;
    }
    totalUpserted += batch.length;
  }

  // Find latest modifiedOn
  let latestModified: string | null = null;
  for (const item of items) {
    if (item.modifiedOn && (!latestModified || item.modifiedOn > latestModified)) {
      latestModified = item.modifiedOn;
    }
  }

  // Update sync status
  await admin.from("snelstart_sync_status").upsert(
    {
      connection_id: conn.id,
      resource_type: resourceType,
      status: "completed",
      last_sync_at: new Date().toISOString(),
      last_modified_filter: latestModified || undefined,
      total_synced: totalUpserted,
      error_message: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "connection_id,resource_type" }
  );

  return totalUpserted;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    // Verify X-Cron-Secret to prevent unauthenticated access
    const cronSecret = Deno.env.get("CRON_SECRET");
    const requestSecret = req.headers.get("X-Cron-Secret") || req.headers.get("x-cron-secret");
    if (!cronSecret || requestSecret !== cronSecret) {
      return jsonRes({ error: "Unauthorized" }, 401);
    }

    const admin = createAdminClient();
    const body = await req.json().catch(() => ({}));
    const syncType: "delta" | "full" = body.sync_type || "delta";
    const connectionId: string | undefined = body.connection_id;

    // Get connections to sync
    let connections: SnelstartConnection[];
    if (connectionId) {
      const { data } = await admin
        .from("snelstart_connections")
        .select("*")
        .eq("id", connectionId)
        .maybeSingle();
      connections = data ? [data as SnelstartConnection] : [];
    } else {
      const { data } = await admin.from("snelstart_connections").select("*");
      connections = (data ?? []) as SnelstartConnection[];
    }

    const results: Record<string, any> = {};

    // Process connections sequentially
    for (const conn of connections) {
      const connResults: Record<string, any> = {};

      for (const resourceType of RESOURCE_TYPES) {
        try {
          const count = await syncResource(admin, conn, resourceType, syncType);
          connResults[resourceType] = { status: "ok", count };
        } catch (err: any) {
          console.error(`Sync error ${resourceType} for ${conn.company_id}:`, err.message);
          connResults[resourceType] = { status: "error", error: err.message };

          // Update sync status with error
          await admin.from("snelstart_sync_status").upsert(
            {
              connection_id: conn.id,
              resource_type: resourceType,
              status: "error",
              error_message: err.message,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "connection_id,resource_type" }
          );
        }

        // Rate limit between resources
        await delay(150);
      }

      results[conn.company_id] = connResults;
    }

    return jsonRes({ ok: true, sync_type: syncType, results });
  } catch (err: any) {
    console.error("snelstart-sync error:", err);
    return jsonRes({ error: err.message || "Internal error" }, 500);
  }
});
