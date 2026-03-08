import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWhatsAppStatus } from "@/hooks/useWhatsAppStatus";
import { useSnelstartConnection } from "@/hooks/useSnelstart";
import { Loader2, Check, X, ExternalLink } from "lucide-react";

interface IntegrationStatus {
  name: string;
  connected: boolean;
  detail?: string;
  tab?: string;
}

const SettingsIntegrationsTab = () => {
  const { companyId } = useAuth();
  const { data: waStatus, isLoading: waLoading } = useWhatsAppStatus();
  const { data: snelstartConn, isLoading: snelLoading } = useSnelstartConnection();
  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const { data } = await supabase.from("companies_safe" as any).select(
        "accounting_provider, has_eboekhouden_token, has_wefact_key, email_provider, outlook_email, moneybird_administration_id, rompslomp_company_id"
      ).eq("id", companyId).single() as { data: any };

      const { data: exactConfig } = await supabase.from("exact_config").select("status").eq("company_id", companyId!).maybeSingle();
      const { data: metaConfig } = await supabase.from("meta_config").select("page_id").eq("company_id", companyId!).maybeSingle();

      const list: IntegrationStatus[] = [];

      // Accounting
      const ap = data?.accounting_provider;
      list.push({
        name: "Boekhouding",
        connected: !!ap,
        detail: ap ? `Provider: ${ap}` : "Geen provider ingesteld",
        tab: "Boekhouding",
      });

      // E-mail
      const isOutlook = data?.email_provider === "outlook";
      list.push({
        name: "E-mail",
        connected: isOutlook ? !!data?.outlook_email : !!data?.smtp_email,
        detail: isOutlook ? `Outlook — ${data?.outlook_email || "niet gekoppeld"}` : "SMTP",
        tab: "E-mail",
      });

      // WhatsApp (loaded from hook)
      list.push({
        name: "WhatsApp",
        connected: !!waStatus?.connected,
        detail: waStatus?.phone ?? undefined,
        tab: "WhatsApp",
      });

      // Exact Online
      list.push({
        name: "Exact Online",
        connected: exactConfig?.status === "active",
        detail: exactConfig?.status ?? "Niet geconfigureerd",
        tab: "Boekhouding",
      });

      // SnelStart
      list.push({
        name: "SnelStart",
        connected: !!snelstartConn,
        tab: "Boekhouding",
      });

      // Moneybird
      list.push({
        name: "Moneybird",
        connected: !!data?.moneybird_administration_id,
        tab: "Boekhouding",
      });

      // Rompslomp
      list.push({
        name: "Rompslomp",
        connected: !!data?.rompslomp_company_id,
        tab: "Boekhouding",
      });

      // Meta / Facebook
      list.push({
        name: "Meta (Facebook/Instagram)",
        connected: !!metaConfig?.page_id,
        tab: "Meta",
      });

      setIntegrations(list);
      setLoading(false);
    })();
  }, [companyId, waStatus, snelstartConn]);

  if (loading || waLoading || snelLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6 space-y-4">
      <h3 className="text-[14px] font-bold">Koppelingen overzicht</h3>
      <p className="text-[12px] text-muted-foreground">Status van alle externe integraties.</p>

      <div className="space-y-2">
        {integrations.map((i) => (
          <div key={i.name} className="flex items-center justify-between p-3 border border-border rounded-sm bg-background">
            <div className="flex items-center gap-3">
              {i.connected ? (
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-success/10"><Check className="h-3.5 w-3.5 text-success" /></span>
              ) : (
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-muted"><X className="h-3.5 w-3.5 text-muted-foreground" /></span>
              )}
              <div>
                <p className="text-[13px] font-bold">{i.name}</p>
                {i.detail && <p className="text-[11px] text-muted-foreground">{i.detail}</p>}
              </div>
            </div>
            {i.tab && (
              <span className="text-[11px] text-muted-foreground">
                Ga naar {i.tab}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SettingsIntegrationsTab;
