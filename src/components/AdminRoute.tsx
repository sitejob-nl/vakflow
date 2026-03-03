import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const AdminRoute = ({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) => {
  const { isAdmin, role } = useAuth();

  // Still loading role
  if (role === null) return null;

  if (!isAdmin) {
    if (fallback) return <>{fallback}</>;
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;
