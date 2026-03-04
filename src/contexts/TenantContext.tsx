import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Industry } from "@/config/industryConfig";

const BRAND_DOMAINS: Record<string, Industry> = {
  "vakflow.nl": "technical",
  "wasflow.nl": "cleaning",
  "groenflow.nl": "landscaping",
  // autoflow.nl and pestflow.nl later
};

export interface TenantData {
  id: string;
  name: string;
  logo_url: string | null;
  brand_color: string | null;
  industry: string;
  subcategory: string;
}

interface TenantContextType {
  tenant: TenantData | null;
  tenantSlug: string | null;
  brandIndustry: Industry | null;
  isTenantSite: boolean;
  loading: boolean;
}

const TenantContext = createContext<TenantContextType>({
  tenant: null,
  tenantSlug: null,
  brandIndustry: null,
  isTenantSite: false,
  loading: false,
});

function detectTenant(hostname: string) {
  // Skip dev / preview environments
  if (
    hostname === "localhost" ||
    hostname.startsWith("localhost:") ||
    hostname.endsWith(".lovable.app") ||
    hostname.endsWith(".vercel.app")
  ) {
    return null;
  }

  const parts = hostname.split(".");
  const baseDomain = parts.slice(-2).join("."); // "vakflow.nl"
  const subdomain = parts.length >= 3 ? parts[0] : null;

  if (!subdomain || subdomain === "app" || subdomain === "www") return null;

  const brandIndustry = BRAND_DOMAINS[baseDomain] ?? null;
  if (!brandIndustry) return null; // unknown domain

  return { subdomain, brandIndustry, baseDomain };
}

export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [loading, setLoading] = useState(false);

  const detected = detectTenant(window.location.hostname);
  const tenantSlug = detected?.subdomain ?? null;
  const brandIndustry = detected?.brandIndustry ?? null;
  const isTenantSite = !!detected;

  useEffect(() => {
    if (!tenantSlug) return;

    const fetchTenant = async () => {
      setLoading(true);
      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/tenant-lookup?slug=${encodeURIComponent(tenantSlug)}`
        );
        if (res.ok) {
          const data = await res.json();
          setTenant(data);
        }
      } catch {
        // silently fail — app works without tenant data
      } finally {
        setLoading(false);
      }
    };

    fetchTenant();
  }, [tenantSlug]);

  return (
    <TenantContext.Provider value={{ tenant, tenantSlug, brandIndustry, isTenantSite, loading }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => useContext(TenantContext);
