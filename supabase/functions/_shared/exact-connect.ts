// _shared/exact-connect.ts — Token ophalen via SiteJob Connect service

const CONNECT_BASE_URL = "https://xeshjkznwdrxjjhbpisn.supabase.co/functions/v1";

interface ExactOnlineConnection {
  tenant_id: string | null;
  webhook_secret: string | null;
  exact_division: number | null;
  region: string | null;
}

interface TokenResponse {
  access_token: string;
  base_url: string;
  division: number;
}

/**
 * Haal een fresh access_token op via de SiteJob Connect service.
 * Stuurt tenant_id + webhook_secret, krijgt access_token + base_url + division terug.
 */
export async function getExactTokenFromConnection(
  connection: ExactOnlineConnection
): Promise<TokenResponse> {
  if (!connection.tenant_id) {
    throw new Error("Connection heeft geen tenant_id");
  }
  if (!connection.webhook_secret) {
    throw new Error("Connection heeft geen webhook_secret");
  }

  const connectApiKey = Deno.env.get("CONNECT_API_KEY");
  if (!connectApiKey) {
    throw new Error("CONNECT_API_KEY is niet geconfigureerd als Supabase secret");
  }

  const response = await fetch(`${CONNECT_BASE_URL}/exact-get-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": connectApiKey,
    },
    body: JSON.stringify({
      tenant_id: connection.tenant_id,
      webhook_secret: connection.webhook_secret,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("SiteJob Connect token error:", response.status, errorText);
    throw new Error(`Token ophalen mislukt (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error("Geen access_token ontvangen van Connect service");
  }

  return {
    access_token: data.access_token,
    base_url: data.base_url || getBaseUrl(connection.region),
    division: data.division || connection.exact_division || 0,
  };
}

function getBaseUrl(region: string | null): string {
  switch (region) {
    case "be": return "https://start.exactonline.be";
    case "de": return "https://start.exactonline.de";
    case "fr": return "https://start.exactonline.fr";
    case "uk": return "https://start.exactonline.co.uk";
    case "us": return "https://start.exactonline.com";
    default: return "https://start.exactonline.nl";
  }
}
