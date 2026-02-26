import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin, role } = useAuth();

  // Still loading role
  if (role === null) return null;

  if (!isAdmin) {
    return <Navigate to="/planning" replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;
