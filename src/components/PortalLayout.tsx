import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { FileText, Wrench, LogOut, CalendarPlus, Receipt, Building2, ScrollText } from "lucide-react";
import vakflowLogo from "@/assets/vakflow-logo.svg";
import { Button } from "@/components/ui/button";

const PortalLayout = () => {
  const { customerName, companyName, companyLogoUrl, signOut } = usePortalAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const tabs = [
    { path: "/portal/quotes", label: "Offertes", icon: FileText },
    { path: "/portal/invoices", label: "Facturen", icon: Receipt },
    { path: "/portal/workorders", label: "Werkbonnen", icon: Wrench },
    { path: "/portal/assets", label: "Objecten", icon: Building2 },
    { path: "/portal/appointments", label: "Afspraken", icon: CalendarPlus },
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <img
            src={companyLogoUrl || vakflowLogo}
            alt="Logo"
            className="h-10 object-contain"
          />
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold truncate">{companyName ?? "Klantportaal"}</p>
            <p className="text-xs text-muted-foreground truncate">
              Welkom, {customerName ?? "Klant"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut()}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Uitloggen</span>
          </Button>
        </div>
        {/* Tab nav */}
        <div className="max-w-3xl mx-auto px-4">
          <nav className="flex gap-1 -mb-px">
            {tabs.map((tab) => {
              const active = location.pathname === tab.path;
              return (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="max-w-3xl mx-auto px-4 py-8 text-center text-xs text-muted-foreground border-t border-border mt-8">
        {companyName && <p>© {new Date().getFullYear()} {companyName}</p>}
      </footer>
    </div>
  );
};

export default PortalLayout;
