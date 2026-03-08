import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { TenantProvider } from "@/contexts/TenantContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
import SuperAdminRoute from "@/components/SuperAdminRoute";
import AppLayout from "@/components/AppLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import AuthPage from "./pages/AuthPage";
import NotFound from "./pages/NotFound";
import PWAUpdatePrompt from "./components/PWAUpdatePrompt";
import { Loader2 } from "lucide-react";

const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const MonteurDashboardPage = lazy(() => import("@/pages/MonteurDashboardPage"));
const PlanningPage = lazy(() => import("@/pages/PlanningPage"));
const CustomersPage = lazy(() => import("@/pages/CustomersPage"));
const CustomerDetailPage = lazy(() => import("@/pages/CustomerDetailPage"));
const WorkOrdersPage = lazy(() => import("@/pages/WorkOrdersPage"));
const WorkOrderDetailPage = lazy(() => import("@/pages/WorkOrderDetailPage"));
const InvoicesPage = lazy(() => import("@/pages/InvoicesPage"));
const QuotesPage = lazy(() => import("@/pages/QuotesPage"));
const CommunicationPage = lazy(() => import("@/pages/CommunicationPage"));
const EmailPage = lazy(() => import("@/pages/EmailPage"));
const WhatsAppPage = lazy(() => import("@/pages/WhatsAppPage"));
const RemindersPage = lazy(() => import("@/pages/RemindersPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const CompanySignupPage = lazy(() => import("@/pages/CompanySignupPage"));
const SuperAdminPage = lazy(() => import("@/pages/SuperAdminPage"));
const ReportsPage = lazy(() => import("@/pages/ReportsPage"));
const AssetsPage = lazy(() => import("@/pages/AssetsPage"));
const MarketingPage = lazy(() => import("@/pages/MarketingPage"));
const ContractsPage = lazy(() => import("@/pages/ContractsPage"));
const MetaCallbackPage = lazy(() => import("@/pages/MetaCallbackPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

const PageLoader = () => (
  <div className="flex items-center justify-center h-full min-h-[200px]">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <PWAUpdatePrompt />
      <BrowserRouter>
        <TenantProvider>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/signup" element={<CompanySignupPage />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <AppLayout />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<AdminRoute fallback={<MonteurDashboardPage />}><DashboardPage /></AdminRoute>} />
                <Route path="planning" element={<PlanningPage />} />
                <Route path="customers" element={<AdminRoute><CustomersPage /></AdminRoute>} />
                <Route path="customers/:id" element={<AdminRoute><CustomerDetailPage /></AdminRoute>} />
                <Route path="workorders" element={<WorkOrdersPage />} />
                <Route path="workorders/:id" element={<WorkOrderDetailPage />} />
                <Route path="invoices" element={<AdminRoute><InvoicesPage /></AdminRoute>} />
                <Route path="quotes" element={<AdminRoute><QuotesPage /></AdminRoute>} />
                <Route path="reports" element={<AdminRoute><ReportsPage /></AdminRoute>} />
                <Route path="communication" element={<AdminRoute><CommunicationPage /></AdminRoute>} />
                <Route path="email" element={<AdminRoute><EmailPage /></AdminRoute>} />
                <Route path="whatsapp" element={<AdminRoute><WhatsAppPage /></AdminRoute>} />
                <Route path="reminders" element={<AdminRoute><RemindersPage /></AdminRoute>} />
                <Route path="contracts" element={<AdminRoute><ContractsPage /></AdminRoute>} />
                <Route path="assets" element={<AdminRoute><AssetsPage /></AdminRoute>} />
                <Route path="marketing" element={<AdminRoute><MarketingPage /></AdminRoute>} />
                <Route path="settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
                <Route path="superadmin" element={<SuperAdminRoute><SuperAdminPage /></SuperAdminRoute>} />
              </Route>
              <Route path="/meta-callback" element={<ProtectedRoute><MetaCallbackPage /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
        </TenantProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
