import { useState } from "react";
import { useMetaConfig } from "@/hooks/useMetaConfig";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Copy, Loader2, Facebook, Unlink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const WEBHOOK_URL = "https://sigzpqwnavfxtvbyqvzj.supabase.co/functions/v1/meta-webhook";

interface Props {
  inputClass: string;
  labelClass: string;
}

const MetaSettingsTab = ({ inputClass, labelClass }: Props) => {
  const { configQuery, statusQuery, saveConfig } = useMetaConfig();
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const connected = statusQuery.data?.connected ?? false;
  const pageName = configQuery.data?.page_name || configQuery.data?.page_id || null;

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-oauth-url", {
        body: { redirect_uri: `${window.location.origin}/meta-callback` },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Redirect to Facebook login
      window.location.href = data.url;
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await saveConfig.mutateAsync({
        page_access_token: "",
        page_id: "",
        instagram_account_id: "",
      });
      toast({ title: "Facebook ontkoppeld" });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6 space-y-5">
      <div>
        <h3 className="text-[14px] font-bold mb-1">Meta (Facebook/Instagram) koppeling</h3>
        <p className="text-[12px] text-secondary-foreground mb-3">
          Koppel je Facebook Page om Leads, Messenger en Instagram DM's te ontvangen.
        </p>
      </div>

      <div className="flex items-center gap-2 mb-3">
        {connected ? (
          <div className="flex items-center gap-1.5 text-[12px] text-green-600">
            <CheckCircle className="w-4 h-4" /> Verbonden{pageName ? ` — ${pageName}` : ""}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <XCircle className="w-4 h-4" /> Niet verbonden
          </div>
        )}
      </div>

      {!connected ? (
        <button
          onClick={handleConnect}
          disabled={isConnecting}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#1877F2] text-white rounded-md text-[13px] font-bold hover:bg-[#166FE5] transition-colors disabled:opacity-50"
        >
          {isConnecting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Facebook className="w-4 h-4" />
          )}
          {isConnecting ? "Doorsturen..." : "Koppel met Facebook"}
        </button>
      ) : (
        <button
          onClick={handleDisconnect}
          disabled={isDisconnecting}
          className="flex items-center gap-2 px-4 py-2 bg-destructive/10 text-destructive rounded-md text-[12px] font-medium hover:bg-destructive/20 transition-colors disabled:opacity-50"
        >
          {isDisconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink className="w-3 h-3" />}
          {isDisconnecting ? "Ontkoppelen..." : "Facebook ontkoppelen"}
        </button>
      )}

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
          Plak deze URL in Meta for Developers → Webhooks → Callback URL. Het verify token wordt automatisch gegenereerd bij het koppelen.
        </p>
      </div>

      {connected && (
        <div className="space-y-2">
          <label className={labelClass}>Webhook Verify Token</label>
          <p className="text-[10px] text-muted-foreground">
            Het verify token is ingesteld als systeemgeheim (META_WEBHOOK_VERIFY_TOKEN). Kopieer deze waarde uit je Supabase Secrets en vul het in bij Meta for Developers → Webhooks → Verify Token.
          </p>
        </div>
      )}
    </div>
  );
};

export default MetaSettingsTab;
