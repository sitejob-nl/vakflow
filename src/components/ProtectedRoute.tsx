import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const [isPortalUser, setIsPortalUser] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setIsPortalUser(null);
      return;
    }
    supabase
      .from("portal_users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setIsPortalUser(!!data));
  }, [user]);

  if (loading || (user && isPortalUser === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (isPortalUser) return <Navigate to="/portal/quotes" replace />;

  return <>{children}</>;
};

export default ProtectedRoute;
