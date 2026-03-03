import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
import AppLayout from "@/components/AppLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import AuthPage from "./pages/AuthPage";
import NotFound from "./pages/NotFound";
import PWAUpdatePrompt from "./components/PWAUpdatePrompt";
import DashboardPage from "@/pages/DashboardPage";
import PlanningPage from "@/pages/PlanningPage";
import CustomersPage from "@/pages/CustomersPage";
import CustomerDetailPage from "@/pages/CustomerDetailPage";
import WorkOrdersPage from "@/pages/WorkOrdersPage";
import WorkOrderDetailPage from "@/pages/WorkOrderDetailPage";
import InvoicesPage from "@/pages/InvoicesPage";
import QuotesPage from "@/pages/QuotesPage";
import CommunicationPage from "@/pages/CommunicationPage";
import EmailPage from "@/pages/EmailPage";
import WhatsAppPage from "@/pages/WhatsAppPage";
import RemindersPage from "@/pages/RemindersPage";
import SettingsPage from "@/pages/SettingsPage";
import CompanySignupPage from "@/pages/CompanySignupPage";
import SuperAdminPage from "@/pages/SuperAdminPage";
import ReportsPage from "@/pages/ReportsPage";
import AssetsPage from "@/pages/AssetsPage";
import MarketingPage from "@/pages/MarketingPage";
import MetaCallbackPage from "@/pages/MetaCallbackPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <PWAUpdatePrompt />
      <BrowserRouter>
        <AuthProvider>
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
              <Route path="dashboard" element={<AdminRoute><DashboardPage /></AdminRoute>} />
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
              <Route path="assets" element={<AdminRoute><AssetsPage /></AdminRoute>} />
              <Route path="marketing" element={<AdminRoute><MarketingPage /></AdminRoute>} />
              <Route path="settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
              <Route path="superadmin" element={<SuperAdminPage />} />
            </Route>
            <Route path="/meta-callback" element={<ProtectedRoute><MetaCallbackPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
