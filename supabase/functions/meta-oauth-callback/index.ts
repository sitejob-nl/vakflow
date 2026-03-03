import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonRes({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return jsonRes({ error: "Unauthorized" }, 401);

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json();
    const { code, redirect_uri, state } = body;

    if (!code) return jsonRes({ error: "Missing code" }, 400);

    // Parse state to get company_id
    let companyId: string;
    try {
      const stateData = JSON.parse(atob(state));
      companyId = stateData.company_id;
    } catch {
      return jsonRes({ error: "Invalid state" }, 400);
    }

    const appId = Deno.env.get("META_APP_ID")!;
    const appSecret = Deno.env.get("META_APP_SECRET")!;

    // Step 1: Exchange code for short-lived token
    const tokenUrl = `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirect_uri)}&client_secret=${appSecret}&code=${code}`;
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error("Token exchange error:", tokenData.error);
      return jsonRes({ error: tokenData.error.message || "Token exchange failed" }, 400);
    }

    const shortLivedToken = tokenData.access_token;

    // Step 2: Exchange for long-lived token
    const longLivedUrl = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`;
    const longLivedRes = await fetch(longLivedUrl);
    const longLivedData = await longLivedRes.json();

    if (longLivedData.error) {
      console.error("Long-lived token error:", longLivedData.error);
      return jsonRes({ error: longLivedData.error.message || "Long-lived token failed" }, 400);
    }

    const userAccessToken = longLivedData.access_token;

    // Step 3: Get pages
    const pagesRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${userAccessToken}`);
    const pagesData = await pagesRes.json();

    if (pagesData.error) {
      console.error("Pages fetch error:", pagesData.error);
      return jsonRes({ error: pagesData.error.message || "Failed to fetch pages" }, 400);
    }

    const pages = (pagesData.data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      access_token: p.access_token,
    }));

    // If action is "list-pages", return the pages for selection
    if (body.action === "list-pages") {
      return jsonRes({ pages });
    }

    // If action is "select-page", save the selected page
    if (body.action === "select-page" && body.page_id) {
      const selectedPage = pages.find((p: any) => p.id === body.page_id);
      if (!selectedPage) return jsonRes({ error: "Page not found" }, 400);

      // Try to get Instagram account ID linked to the page
      let instagramAccountId = null;
      try {
        const igRes = await fetch(`https://graph.facebook.com/v21.0/${selectedPage.id}?fields=instagram_business_account&access_token=${selectedPage.access_token}`);
        const igData = await igRes.json();
        instagramAccountId = igData.instagram_business_account?.id || null;
      } catch {
        // Instagram account is optional
      }

      // Generate a random webhook verify token
      const webhookVerifyToken = crypto.randomUUID();

      // Upsert meta_config
      const { error: upsertErr } = await supabaseAdmin.from("meta_config").upsert(
        {
          company_id: companyId,
          page_id: selectedPage.id,
          page_name: selectedPage.name,
          page_access_token: selectedPage.access_token,
          user_access_token: userAccessToken,
          instagram_account_id: instagramAccountId,
          webhook_verify_token: webhookVerifyToken,
        },
        { onConflict: "company_id" }
      );

      if (upsertErr) {
        console.error("Upsert error:", upsertErr);
        return jsonRes({ error: upsertErr.message }, 500);
      }

      return jsonRes({
        success: true,
        page_id: selectedPage.id,
        page_name: selectedPage.name,
        instagram_account_id: instagramAccountId,
      });
    }

    // Default: exchange code and return pages for selection
    // Save user_access_token temporarily
    await supabaseAdmin.from("meta_config").upsert(
      { company_id: companyId, user_access_token: userAccessToken },
      { onConflict: "company_id" }
    );

    return jsonRes({ pages, user_access_token: userAccessToken });
  } catch (err: any) {
    console.error("meta-oauth-callback error:", err);
    return jsonRes({ error: err.message || "Internal error" }, 500);
  }
});
