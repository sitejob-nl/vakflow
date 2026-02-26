import { Navigate } from "react-router-dom";

// Legacy entry point — redirect to dashboard
const Index = () => <Navigate to="/dashboard" replace />;

export default Index;
