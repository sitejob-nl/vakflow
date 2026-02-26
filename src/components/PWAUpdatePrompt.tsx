import { useRegisterSW } from "virtual:pwa-register/react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

const PWAUpdatePrompt = () => {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 z-50 flex justify-center animate-page-in">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg max-w-md w-full">
        <RefreshCw className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm text-foreground flex-1">Nieuwe versie beschikbaar</span>
        <Button size="sm" onClick={() => updateServiceWorker(true)}>
          Bijwerken
        </Button>
      </div>
    </div>
  );
};

export default PWAUpdatePrompt;
