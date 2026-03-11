import { lazy, Suspense, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAccountingProvider } from "@/hooks/useAccountingProvider";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ExternalLink, Settings, ArrowRight } from "lucide-react";
import ProviderSyncPanel from "@/components/ProviderSyncPanel";

const MoneybirdAdmin = lazy(() => import("@/components/MoneybirdAdmin"));
const RompslompAdmin = lazy(() => import("@/components/RompslompAdmin"));
const ExactAdmin = lazy(() => import("@/components/ExactAdmin"));
const EboekhoudenAdmin = lazy(() => import("@/components/EboekhoudenAdmin"));
const WefactAdmin = lazy(() => import("@/components/WefactAdmin"));
const SnelstartAdmin = lazy(() => import("@/components/SnelstartAdmin"));

const PROVIDER_INFO: Record<string, { name: string; url: string; description: string }> = {
  exact: {
    name: "Exact Online",
    url: "https://www.exact.com/nl/producten/boekhouden",
    description: "Je facturen, offertes en klantgegevens worden automatisch gesynchroniseerd met Exact Online.",
  },
  eboekhouden: {
    name: "e-Boekhouden",
    url: "https://www.e-boekhouden.nl",
    description: "Je facturen en klantgegevens worden automatisch gesynchroniseerd met e-Boekhouden.",
  },
  snelstart: {
    name: "SnelStart",
    url: "https://www.snelstart.nl",
    description: "Je artikelen, relaties en facturen worden automatisch gesynchroniseerd met SnelStart.",
  },
  wefact: {
    name: "WeFact",
    url: "https://www.wefact.nl",
    description: "Je facturen, klanten en producten worden automatisch gesynchroniseerd met WeFact.",
  },
};

const ProviderPlaceholder = ({ providerKey }: { providerKey: string }) => {
  const info = PROVIDER_INFO[providerKey];
  if (!info) return null;

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-bold">{info.name}</h2>
            <p className="text-sm text-muted-foreground max-w-lg">{info.description}</p>
          </div>
          <a
            href={info.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary hover:text-primary/80 border border-border rounded-md hover:bg-muted/50 transition-colors"
          >
            Open {info.name} <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <div className="bg-muted/50 border border-border rounded-md p-4 text-sm text-muted-foreground">
          <p>Beheer je facturen, contacten en producten direct in {info.name}. Wijzigingen worden automatisch gesynchroniseerd met Vakflow.</p>
        </div>
      </div>

      {/* Sync panel for all providers */}
      <ProviderSyncPanel provider={providerKey} />
    </div>
  );
};

const AccountingAdminPage = () => {
  const provider = useAccountingProvider();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (provider === null) {
      // Still loading or no provider — handled below
    }
  }, [provider]);

  const handleGoToSettings = () => {
    navigate("/settings");
    toast({ title: "Stel eerst een boekhoudkoppeling in bij Instellingen → Boekhouding" });
  };

  // Loading state while provider query resolves
  if (provider === undefined) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Boekhouding</h1>
          <p className="text-sm text-muted-foreground">
            {provider ? `Gekoppeld met ${PROVIDER_INFO[provider]?.name ?? provider}` : "Geen koppeling actief"}
          </p>
        </div>
        <button
          onClick={() => navigate("/settings")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-muted/50 transition-colors"
        >
          <Settings className="h-3.5 w-3.5" /> Instellingen
        </button>
      </div>

      {!provider ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Settings className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold">Geen boekhouding gekoppeld</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Koppel je boekhoudpakket om facturen, offertes en klantgegevens automatisch te synchroniseren.
            </p>
          </div>
          <button
            onClick={handleGoToSettings}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-bold hover:bg-primary/90 transition-colors"
          >
            Koppel je boekhouding <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : provider === "moneybird" ? (
        <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
          <MoneybirdAdmin />
        </Suspense>
      ) : provider === "rompslomp" ? (
        <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
          <RompslompAdmin />
        </Suspense>
      ) : (
        <ProviderPlaceholder providerKey={provider} />
      )}
    </div>
  );
};

export default AccountingAdminPage;
