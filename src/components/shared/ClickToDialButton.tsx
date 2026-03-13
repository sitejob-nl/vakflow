import { Phone, Loader2 } from "lucide-react";
import { useClickToDial } from "@/hooks/useClickToDial";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ClickToDialButtonProps {
  phoneNumber: string | null | undefined;
  customerId?: string;
  variant?: "icon" | "button";
}

export default function ClickToDialButton({ phoneNumber, customerId, variant = "icon" }: ClickToDialButtonProps) {
  const { enabledFeatures } = useAuth();
  const clickToDial = useClickToDial();

  if (!enabledFeatures.includes("voip") || !phoneNumber?.trim()) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    clickToDial.mutate({ phone_number: phoneNumber, customer_id: customerId });
  };

  if (variant === "button") {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={clickToDial.isPending}
      >
        {clickToDial.isPending ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <Phone className="h-4 w-4 mr-1" />
        )}
        Bel
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={handleClick}
          disabled={clickToDial.isPending}
          className="inline-flex items-center justify-center h-6 w-6 rounded-md hover:bg-muted transition-colors disabled:opacity-50"
        >
          {clickToDial.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : (
            <Phone className="h-3.5 w-3.5 text-primary" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">Click-to-dial</p>
      </TooltipContent>
    </Tooltip>
  );
}
