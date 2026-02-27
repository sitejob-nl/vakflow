import { useAuth } from "@/contexts/AuthContext";
import { X, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

const ImpersonationBanner = () => {
  const { isImpersonating, impersonatedCompanyName, stopImpersonating } = useAuth();

  if (!isImpersonating) return null;

  return (
    <div className="bg-primary text-primary-foreground px-4 py-2 flex items-center justify-between text-sm font-medium z-50">
      <div className="flex items-center gap-2">
        <Eye className="w-4 h-4" />
        <span>Je bekijkt data als: <strong>{impersonatedCompanyName}</strong></span>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={stopImpersonating}
        className="h-7 text-xs"
      >
        <X className="w-3 h-3 mr-1" /> Stoppen
      </Button>
    </div>
  );
};

export default ImpersonationBanner;
