import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface Page {
  id: string;
  name: string;
  access_token: string;
}

const MetaCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<"loading" | "select" | "saving" | "done" | "error">("loading");
  const [pages, setPages] = useState<Page[]>([]);
  const [error, setError] = useState("");

  const code = searchParams.get("code");
  const state = searchParams.get("state");

  useEffect(() => {
    if (!code || !state) {
      setStatus("error");
      setError("Geen autorisatiecode ontvangen van Facebook.");
      return;
    }

    const exchangeCode = async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke("meta-oauth-callback", {
          body: {
            code,
            state,
            redirect_uri: `${window.location.origin}/meta-callback`,
          },
        });

        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);

        if (data?.pages && data.pages.length > 0) {
          setPages(data.pages);
          setStatus("select");
        } else if (data?.pages && data.pages.length === 0) {
          setStatus("error");
          setError("Geen Facebook Pages gevonden op dit account. Zorg dat je een Facebook Page hebt.");
        }
      } catch (err: any) {
        console.error("OAuth callback error:", err);
        setStatus("error");
        setError(err.message || "Er is een fout opgetreden bij het koppelen.");
      }
    };

    exchangeCode();
  }, [code, state]);

  const selectPage = async (pageId: string) => {
    setStatus("saving");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("meta-oauth-callback", {
        body: {
          code,
          state,
          redirect_uri: `${window.location.origin}/meta-callback`,
          action: "select-page",
          page_id: pageId,
        },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setStatus("done");
      toast({ title: "Facebook gekoppeld!", description: `Page "${data.page_name}" is succesvol gekoppeld.` });
      setTimeout(() => navigate("/settings"), 2000);
    } catch (err: any) {
      setStatus("error");
      setError(err.message || "Fout bij het opslaan van de pagina.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg shadow-card p-6 md:p-8 max-w-md w-full space-y-4">
        <h1 className="text-lg font-bold text-foreground">Facebook koppelen</h1>

        {status === "loading" && (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Autorisatie verwerken...</span>
          </div>
        )}

        {status === "select" && (
          <div className="space-y-3">
            <p className="text-sm text-secondary-foreground">Kies de Facebook Page die je wilt koppelen:</p>
            {pages.map((page) => (
              <button
                key={page.id}
                onClick={() => selectPage(page.id)}
                className="w-full text-left px-4 py-3 bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
              >
                <span className="text-sm font-medium text-foreground">{page.name}</span>
                <span className="block text-xs text-muted-foreground">ID: {page.id}</span>
              </button>
            ))}
          </div>
        )}

        {status === "saving" && (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Pagina koppelen...</span>
          </div>
        )}

        {status === "done" && (
          <div className="flex items-center gap-3 text-green-600">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm">Gekoppeld! Je wordt doorgestuurd naar instellingen...</span>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm">{error}</span>
            </div>
            <button
              onClick={() => navigate("/settings")}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-sm text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Terug naar instellingen
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MetaCallbackPage;
