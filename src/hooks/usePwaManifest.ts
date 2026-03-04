import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Dynamically overrides the PWA manifest <link> with company-specific
 * pwa_name and pwa_icon_url when available.
 * Call refresh() after saving new PWA settings.
 */
export function usePwaManifest() {
  const { user } = useAuth();
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile?.company_id || cancelled) return;

      const { data: company } = await supabase
        .from("companies_safe" as any)
        .select("pwa_name, pwa_icon_url, name")
        .eq("id", profile.company_id)
        .single();

      if (!company || cancelled) return;

      const c = company as any;
      const pwaName = c.pwa_name || c.name || "Vakflow";
      const pwaIconUrl = c.pwa_icon_url;

      // Only override if there's a custom name or icon
      if (!c.pwa_name && !pwaIconUrl) return;

      const icons = pwaIconUrl
        ? [
            { src: pwaIconUrl, sizes: "192x192", type: "image/png" },
            { src: pwaIconUrl, sizes: "512x512", type: "image/png" },
            { src: pwaIconUrl, sizes: "512x512", type: "image/png", purpose: "maskable" },
          ]
        : [
            { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
            { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
            { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ];

      const manifest = {
        name: pwaName,
        short_name: pwaName,
        description: `Service & planning platform — ${pwaName}`,
        theme_color: "#383eed",
        background_color: "#f5f5f7",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons,
      };

      const blob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      // Replace or create the manifest link
      let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
      if (link) {
        link.href = url;
      } else {
        link = document.createElement("link");
        link.rel = "manifest";
        link.href = url;
        document.head.appendChild(link);
      }

      // Also update the apple-touch-icon if custom icon
      if (pwaIconUrl) {
        let appleIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
        if (appleIcon) {
          appleIcon.href = pwaIconUrl;
        } else {
          appleIcon = document.createElement("link");
          appleIcon.rel = "apple-touch-icon";
          appleIcon.href = pwaIconUrl;
          document.head.appendChild(appleIcon);
        }
      }

      // Update document title to match PWA name
      if (c.pwa_name) {
        document.title = pwaName;
      }

      return () => {
        URL.revokeObjectURL(url);
      };
    })();

    return () => {
      cancelled = true;
    };
  }, [user, version]);

  return { refresh };
}
