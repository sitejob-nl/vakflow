import { useState, useEffect } from "react";
import { Download, Share, MoreVertical, Plus, ChevronDown, ChevronUp, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

type Platform = "ios" | "android" | "desktop" | null;

const detectPlatform = (): Platform => {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
};

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as any).standalone === true;

const PWAInstallGuide = () => {
  const [platform, setPlatform] = useState<Platform>(null);
  const [expanded, setExpanded] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(isStandalone());

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (installed || platform === "desktop") return null;

  const handleNativeInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  return (
    <div className="w-full max-w-md mt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
      >
        <Smartphone className="h-4 w-4" />
        <span>Installeer als app op je telefoon</span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {expanded && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3 animate-page-in">
          {deferredPrompt ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Installeer VentFlow direct als app voor snelle toegang.
              </p>
              <Button onClick={handleNativeInstall} className="w-full" variant="outline">
                <Download className="h-4 w-4 mr-2" /> Installeer app
              </Button>
            </div>
          ) : platform === "ios" ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">iPhone / iPad</p>
              <ol className="text-sm text-muted-foreground space-y-2.5">
                <li className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">1</span>
                  <span>Tik op het <Share className="inline h-3.5 w-3.5 -mt-0.5 text-primary" /> <strong>Deel</strong>-icoon onderaan Safari</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">2</span>
                  <span>Scroll naar beneden en tik op <Plus className="inline h-3.5 w-3.5 -mt-0.5 text-primary" /> <strong>Zet op beginscherm</strong></span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">3</span>
                  <span>Tik op <strong>Voeg toe</strong> — klaar!</span>
                </li>
              </ol>
            </div>
          ) : platform === "android" ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Android</p>
              <ol className="text-sm text-muted-foreground space-y-2.5">
                <li className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">1</span>
                  <span>Tik op <MoreVertical className="inline h-3.5 w-3.5 -mt-0.5 text-primary" /> het <strong>menu</strong> (3 puntjes) rechtsboven</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">2</span>
                  <span>Tik op <Download className="inline h-3.5 w-3.5 -mt-0.5 text-primary" /> <strong>App installeren</strong> of <strong>Toevoegen aan startscherm</strong></span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">3</span>
                  <span>Bevestig — klaar!</span>
                </li>
              </ol>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground/70 text-center pt-1">
            De app werkt offline en opent razendsnel 🚀
          </p>
        </div>
      )}
    </div>
  );
};

export default PWAInstallGuide;
