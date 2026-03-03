import { useState, useEffect } from "react";
import { useMetaConfig } from "@/hooks/useMetaConfig";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Copy, Loader2 } from "lucide-react";

const WEBHOOK_URL = "https://sigzpqwnavfxtvbyqvzj.supabase.co/functions/v1/meta-webhook";

interface Props {
  inputClass: string;
  labelClass: string;
}

const MetaSettingsTab = ({ inputClass, labelClass }: Props) => {
  const { configQuery, saveConfig } = useMetaConfig();
  const { toast } = useToast();

  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [pageAccessToken, setPageAccessToken] = useState("");
  const [pageId, setPageId] = useState("");
  const [instagramAccountId, setInstagramAccountId] = useState("");
  const [webhookVerifyToken, setWebhookVerifyToken] = useState("");

  useEffect(() => {
    if (configQuery.data) {
      setAppId(configQuery.data.app_id || "");
      setPageId(configQuery.data.page_id || "");
      setInstagramAccountId(configQuery.data.instagram_account_id || "");
      setWebhookVerifyToken(configQuery.data.webhook_verify_token || "");
    }
  }, [configQuery.data]);

  const handleSave = async () => {
    try {
      await saveConfig.mutateAsync({
        app_id: appId || undefined,
        app_secret: appSecret || undefined,
        page_access_token: pageAccessToken || undefined,
        page_id: pageId || undefined,
        instagram_account_id: instagramAccountId || undefined,
        webhook_verify_token: webhookVerifyToken || undefined,
      });
      toast({ title: "Meta configuratie opgeslagen" });
      setAppSecret("");
      setPageAccessToken("");
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const connected = configQuery.data?.connected ?? false;

  return (
    <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6 space-y-5">
      <div>
        <h3 className="text-[14px] font-bold mb-1">Meta (Facebook/Instagram) koppeling</h3>
        <p className="text-[12px] text-secondary-foreground mb-3">
          Koppel je Meta App om Facebook Leads, Messenger en Instagram DM's te ontvangen.
        </p>
      </div>

      <div className="flex items-center gap-2 mb-3">
        {connected ? (
          <div className="flex items-center gap-1.5 text-[12px] text-green-600"><CheckCircle className="w-4 h-4" /> Verbonden</div>
        ) : (
          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground"><XCircle className="w-4 h-4" /> Niet verbonden</div>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <label className={labelClass}>App ID</label>
          <input value={appId} onChange={(e) => setAppId(e.target.value)} className={inputClass} placeholder="Je Meta App ID" />
        </div>
        <div>
          <label className={labelClass}>App Secret</label>
          <input value={appSecret} onChange={(e) => setAppSecret(e.target.value)} className={inputClass} placeholder={connected ? "••••••••" : "Je Meta App Secret"} type="password" />
          <p className="text-[10px] text-muted-foreground mt-0.5">Wordt versleuteld opgeslagen. Laat leeg om huidige waarde te behouden.</p>
        </div>
        <div>
          <label className={labelClass}>Page Access Token</label>
          <input value={pageAccessToken} onChange={(e) => setPageAccessToken(e.target.value)} className={inputClass} placeholder={connected ? "••••••••" : "Je Page Access Token"} type="password" />
          <p className="text-[10px] text-muted-foreground mt-0.5">Genereer een "Page Access Token" via de <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Graph API Explorer</a>.</p>
        </div>
        <div>
          <label className={labelClass}>Page ID</label>
          <input value={pageId} onChange={(e) => setPageId(e.target.value)} className={inputClass} placeholder="Je Facebook Page ID" />
        </div>
        <div>
          <label className={labelClass}>Instagram Account ID (optioneel)</label>
          <input value={instagramAccountId} onChange={(e) => setInstagramAccountId(e.target.value)} className={inputClass} placeholder="Instagram Business Account ID" />
        </div>
        <div>
          <label className={labelClass}>Webhook Verify Token</label>
          <input value={webhookVerifyToken} onChange={(e) => setWebhookVerifyToken(e.target.value)} className={inputClass} placeholder="Zelfgekozen verify token" />
          <p className="text-[10px] text-muted-foreground mt-0.5">Kies een willekeurig wachtwoord en vul dit ook in bij Meta → Webhooks → Verify Token.</p>
        </div>
      </div>

      <div className="border-t border-border pt-4 space-y-2">
        <label className={labelClass}>Webhook URL (kopieer naar Meta for Developers)</label>
        <div className="flex items-center gap-2">
          <input value={WEBHOOK_URL} readOnly className={inputClass + " bg-muted"} />
          <button
            type="button"
            onClick={() => { navigator.clipboard.writeText(WEBHOOK_URL); toast({ title: "Gekopieerd" }); }}
            className="px-3 py-2.5 bg-secondary text-secondary-foreground rounded-sm text-[12px] hover:bg-secondary/80 transition-colors"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Plak deze URL in Meta for Developers → Webhooks → Callback URL. Selecteer de subscriptions: <strong>leadgen</strong>, <strong>messages</strong>, <strong>messaging_postbacks</strong>.
        </p>
      </div>

      <div className="border-t border-border pt-4">
        <h4 className="text-[13px] font-bold mb-2">Stappen om te koppelen:</h4>
        <ol className="text-[12px] text-secondary-foreground space-y-1 list-decimal list-inside">
          <li>Ga naar <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Meta for Developers</a> en maak een app</li>
          <li>Selecteer use cases: Lead Ads, Messenger, Instagram DM's, Page beheer</li>
          <li>Kopieer de App ID en App Secret hierboven</li>
          <li>Genereer een Page Access Token via de Graph API Explorer</li>
          <li>Stel de webhook URL in met bovenstaande URL en verify token</li>
          <li>Sla de configuratie op</li>
        </ol>
      </div>

      <button
        onClick={handleSave}
        disabled={saveConfig.isPending}
        className="px-5 py-2.5 bg-primary text-primary-foreground rounded-sm text-[13px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50"
      >
        {saveConfig.isPending ? <><Loader2 className="inline w-3 h-3 mr-1 animate-spin" /> Opslaan...</> : "Meta configuratie opslaan"}
      </button>
    </div>
  );
};

export default MetaSettingsTab;
