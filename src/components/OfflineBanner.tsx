import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";

const OfflineBanner = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="bg-accent text-accent-foreground px-4 py-2 text-sm flex items-center gap-2 justify-center shrink-0">
      <WifiOff className="h-4 w-4" />
      <span>Je bent offline — sommige functies zijn beperkt</span>
    </div>
  );
};

export default OfflineBanner;
