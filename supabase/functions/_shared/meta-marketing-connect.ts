// _shared/meta-marketing-connect.ts — Token ophalen via SiteJob Connect voor Meta Marketing

const CONNECT_BASE_URL = "https://xeshjkznwdrxjjhbpisn.supabase.co/functions/v1";

export interface MetaMarketingTokenResponse {
  user_access_token: string;
  page_access_token: string | null;
  ad_account_id: string | null;
  ad_account_name: string | null;
  page_id: string | null;
  page_name: string | null;
  instagram_id: string | null;
  instagram_username: string | null;
  expires_at: string;
  needs_reauth?: boolean;
}

/**
 * Haal verse Meta Marketing tokens op via SiteJob Connect.
 * Roep dit aan vóór elke Meta Graph API call.
 */
export async function getMetaMarketingToken(config: {
  tenant_id: string;
  webhook_secret: string;
}): Promise<MetaMarketingTokenResponse> {
  if (!config.tenant_id) {
    throw new Error("Config heeft geen tenant_id");
  }
  if (!config.webhook_secret) {
    throw new Error("Config heeft geen webhook_secret");
  }

  const response = await fetch(`${CONNECT_BASE_URL}/meta-marketing-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tenant_id: config.tenant_id,
      secret: config.webhook_secret,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
    if (errorData.needs_reauth) {
      const err = new Error("Re-authentication required — open de setup-link opnieuw");
      (err as any).needs_reauth = true;
      throw err;
    }
    throw new Error(`Meta Marketing token ophalen mislukt (${response.status}): ${errorData.error || "Unknown"}`);
  }

  const data = await response.json();

  if (!data.user_access_token) {
    throw new Error("Geen user_access_token ontvangen van Connect service");
  }

  return data;
}
