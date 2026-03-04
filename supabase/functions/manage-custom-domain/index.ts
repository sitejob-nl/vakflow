import { corsHeaders, jsonRes, optionsResponse } from "../_shared/cors.ts";
import { authenticateRequest, createAdminClient, AuthError } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    // Authenticate + get company
    const { userId, companyId } = await authenticateRequest(req);

    // Admin check
    const admin = createAdminClient();
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) {
      return jsonRes({ error: "Alleen admins kunnen custom domains beheren" }, 403);
    }

    // Check of het bedrijf de custom_domain module heeft
    const { data: companyCheck } = await admin
      .from("companies")
      .select("enabled_features")
      .eq("id", companyId)
      .single();

    const features: string[] = companyCheck?.enabled_features ?? [];
    if (!features.includes("custom_domain")) {
      return jsonRes({ error: "Custom domain module is niet geactiveerd voor dit bedrijf" }, 403);
    }

    if (req.method === "POST") {
      const { domain } = await req.json();

      // Validate domain format
      if (!domain || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain)) {
        return jsonRes({ error: "Ongeldig domein formaat" }, 400);
      }

      // Save to DB (only for own company)
      const { error: dbErr } = await admin
        .from("companies")
        .update({ custom_domain: domain })
        .eq("id", companyId);

      if (dbErr) {
        if (dbErr.code === "23505") {
          return jsonRes({ error: "Dit domein is al in gebruik" }, 409);
        }
        return jsonRes({ error: dbErr.message }, 500);
      }

      // Add domain to Vercel project
      const vercelToken = Deno.env.get("VERCEL_TOKEN");
      const vercelProjectId = Deno.env.get("VERCEL_PROJECT_ID");

      if (!vercelToken || !vercelProjectId) {
        return jsonRes({
          success: true,
          domain,
          vercel: null,
          warning: "Vercel credentials niet geconfigureerd — domein is opgeslagen maar niet automatisch toegevoegd aan Vercel",
        });
      }

      const vercelRes = await fetch(
        `https://api.vercel.com/v10/projects/${vercelProjectId}/domains`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${vercelToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: domain }),
        }
      );

      const vercelData = await vercelRes.json();
      console.log("Vercel POST response:", JSON.stringify(vercelData));

      let verification = vercelData.verification ?? [];
      if (!vercelData.verified && !verification.some((r: any) => r.type === 'CNAME')) {
        const subdomain = domain.split('.')[0];
        verification = [
          { type: 'CNAME', domain: subdomain, value: 'cname.vercel-dns.com' },
          ...verification,
        ];
      }

      return jsonRes({
        success: true,
        domain,
        vercel: {
          status: vercelRes.status,
          verified: vercelData.verified ?? false,
          verification,
        },
      });
    }

    if (req.method === "GET") {
      // Get current domain + Vercel status
      const { data: company } = await admin
        .from("companies")
        .select("custom_domain")
        .eq("id", companyId)
        .single();

      const domain = company?.custom_domain;
      if (!domain) {
        return jsonRes({ domain: null, vercel: null });
      }

      const vercelToken = Deno.env.get("VERCEL_TOKEN");
      const vercelProjectId = Deno.env.get("VERCEL_PROJECT_ID");

      if (!vercelToken || !vercelProjectId) {
        return jsonRes({ domain, vercel: null });
      }

      // Check domain status at Vercel
      const vercelRes = await fetch(
        `https://api.vercel.com/v9/projects/${vercelProjectId}/domains/${encodeURIComponent(domain)}`,
        {
          headers: { Authorization: `Bearer ${vercelToken}` },
        }
      );

      const vercelData = await vercelRes.json();
      console.log("Vercel GET response:", JSON.stringify(vercelData));

      let verification = vercelData.verification ?? [];
      if (!vercelData.verified && !verification.some((r: any) => r.type === 'CNAME')) {
        const subdomain = domain.split('.')[0];
        verification = [
          { type: 'CNAME', domain: subdomain, value: 'cname.vercel-dns.com' },
          ...verification,
        ];
      }

      return jsonRes({
        domain,
        vercel: {
          verified: vercelData.verified ?? false,
          verification,
          configured: vercelRes.ok,
        },
      });
    }

    if (req.method === "DELETE") {
      // Get current domain
      const { data: company } = await admin
        .from("companies")
        .select("custom_domain")
        .eq("id", companyId)
        .single();

      const domain = company?.custom_domain;

      // Remove from Vercel if configured
      const vercelToken = Deno.env.get("VERCEL_TOKEN");
      const vercelProjectId = Deno.env.get("VERCEL_PROJECT_ID");

      if (domain && vercelToken && vercelProjectId) {
        await fetch(
          `https://api.vercel.com/v9/projects/${vercelProjectId}/domains/${encodeURIComponent(domain)}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${vercelToken}` },
          }
        );
      }

      // Clear from DB
      await admin
        .from("companies")
        .update({ custom_domain: null })
        .eq("id", companyId);

      return jsonRes({ success: true });
    }

    return jsonRes({ error: "Method not allowed" }, 405);
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonRes({ error: err.message }, err.status);
    }
    return jsonRes({ error: "Internal server error" }, 500);
  }
});
