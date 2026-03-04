// _shared/cors.ts — Eén plek voor CORS headers en response helpers

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/[a-z0-9-]+\.vakflow\.nl$/,
  /^https:\/\/[a-z0-9-]+\.wasflow\.nl$/,
  /^https:\/\/[a-z0-9-]+\.groenflow\.nl$/,
  /^https?:\/\/localhost(:\d+)?$/,
];

/** Controleer of een origin is toegestaan */
function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGIN_PATTERNS.some((p) => p.test(origin));
}

/** Statische fallback headers (voor webhooks zonder Origin header) */
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-webhook-secret",
};

/** Dynamische CORS headers op basis van request Origin */
export function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  if (origin && isAllowedOrigin(origin)) {
    return { ...corsHeaders, "Access-Control-Allow-Origin": origin };
  }
  // Geen bekende origin (webhook, server-to-server) → geen restrictie
  return corsHeaders;
}

export function jsonRes(data: unknown, status = 200, req?: Request) {
  const headers = req ? corsFor(req) : corsHeaders;
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

export function optionsResponse(req?: Request) {
  const headers = req ? corsFor(req) : corsHeaders;
  return new Response(null, { headers });
}
