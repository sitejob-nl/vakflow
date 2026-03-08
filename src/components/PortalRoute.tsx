import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { Loader2 } from "lucide-react";

const PortalRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading, customerId } = usePortalAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/portal/login" replace />;
  if (!customerId) return <Navigate to="/portal/login" replace />;

  return <>{children}</>;
};

export default PortalRoute;
