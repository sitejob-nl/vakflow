// _shared/snelstart-client.ts — SnelStart B2B API v2 helper

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const SNELSTART_AUTH_URL = "https://auth.snelstart.nl/b2b/token";
const SNELSTART_API_BASE = "https://b2bapi.snelstart.nl/v2";

export interface SnelstartConnection {
  id: string;
  company_id: string;
  client_key: string;
  subscription_key: string;
  access_token: string | null;
  token_expires_at: string | null;
}

/**
 * Get a valid bearer token for a SnelStart connection.
 * Caches in DB; refreshes when < 5 min remaining.
 */
export async function getSnelstartToken(
  adminClient: SupabaseClient,
  connection: SnelstartConnection
): Promise<string> {
  // Check cached token validity
  if (connection.access_token && connection.token_expires_at) {
    const expiresAt = new Date(connection.token_expires_at).getTime();
    const fiveMinFromNow = Date.now() + 5 * 60 * 1000;
    if (expiresAt > fiveMinFromNow) {
      return connection.access_token;
    }
  }

  // Request new token
  const body = new URLSearchParams({
    grant_type: "clientkey",
    clientkey: connection.client_key,
  });

  const res = await fetch(SNELSTART_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`SnelStart auth failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const accessToken = data.access_token;
  const expiresIn = data.expires_in || 3599; // seconds
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  // Cache in DB
  await adminClient
    .from("snelstart_connections")
    .update({ access_token: accessToken, token_expires_at: expiresAt, updated_at: new Date().toISOString() })
    .eq("id", connection.id);

  connection.access_token = accessToken;
  connection.token_expires_at = expiresAt;

  return accessToken;
}

/**
 * Generic SnelStart API call with auth headers.
 */
export async function snelstartFetch(
  adminClient: SupabaseClient,
  connection: SnelstartConnection,
  endpoint: string,
  method: string = "GET",
  body?: unknown,
  queryParams?: Record<string, string>
): Promise<any> {
  const token = await getSnelstartToken(adminClient, connection);

  let url = `${SNELSTART_API_BASE}${endpoint}`;
  if (queryParams) {
    const params = new URLSearchParams(queryParams);
    url += `?${params.toString()}`;
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Ocp-Apim-Subscription-Key": connection.subscription_key,
    "Content-Type": "application/json",
  };

  const fetchOpts: RequestInit = { method, headers };
  if (body && method !== "GET") {
    fetchOpts.body = JSON.stringify(body);
  }

  const res = await fetch(url, fetchOpts);

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`SnelStart API ${method} ${endpoint} failed (${res.status}): ${errText}`);
  }

  // DELETE returns 204 no content
  if (res.status === 204) return null;

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return await res.json();
  }
  return await res.text();
}

/**
 * Paginated GET with OData $skip/$top. Max 500 per page.
 * 150ms delay between calls for rate limiting.
 */
export async function snelstartGetAll(
  adminClient: SupabaseClient,
  connection: SnelstartConnection,
  endpoint: string,
  filter?: string
): Promise<any[]> {
  const pageSize = 500;
  let skip = 0;
  const allResults: any[] = [];

  while (true) {
    const params: Record<string, string> = {
      $top: String(pageSize),
      $skip: String(skip),
    };
    if (filter) params.$filter = filter;

    const page = await snelstartFetch(adminClient, connection, endpoint, "GET", undefined, params);
    const items = Array.isArray(page) ? page : [];
    allResults.push(...items);

    if (items.length < pageSize) break;
    skip += pageSize;

    // Rate limit delay
    await new Promise((r) => setTimeout(r, 150));
  }

  return allResults;
}

/**
 * Get the SnelStart connection for a company.
 */
export async function getConnectionForCompany(
  adminClient: SupabaseClient,
  companyId: string
): Promise<SnelstartConnection | null> {
  const { data } = await adminClient
    .from("snelstart_connections")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();

  return data as SnelstartConnection | null;
}

/**
 * Delay helper for rate limiting.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
