import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { FileText, Wrench, LogOut, CalendarPlus, Receipt, Building2, ScrollText, Headset } from "lucide-react";
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
    { path: "/portal/contracts", label: "Contracten", icon: ScrollText },
    { path: "/portal/assets", label: "Objecten", icon: Building2 },
    { path: "/portal/appointments", label: "Afspraken", icon: CalendarPlus },
  ];

  return (
    <div className="min-h-screen bg-muted/30 pb-20 sm:pb-0">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center gap-3">
          <img
            src={companyLogoUrl || vakflowLogo}
            alt="Logo"
            className="h-8 sm:h-10 object-contain shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm sm:text-base font-bold truncate">{companyName ?? "Klantportaal"}</p>
            <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
              Welkom, {customerName ?? "Klant"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut()}
            className="text-muted-foreground hover:text-foreground px-2 sm:px-3"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline ml-1.5">Uitloggen</span>
          </Button>
        </div>

        {/* Desktop tab nav – hidden on mobile */}
        <div className="max-w-3xl mx-auto px-3 sm:px-4 hidden sm:block">
          <nav className="flex gap-1 -mb-px overflow-x-auto">
            {tabs.map((tab) => {
              const active = location.pathname === tab.path;
              return (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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
      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <Outlet />
      </main>

      {/* Footer – hidden on mobile */}
      <footer className="hidden sm:block max-w-3xl mx-auto px-4 py-8 text-center text-xs text-muted-foreground border-t border-border mt-8">
        {companyName && <p>© {new Date().getFullYear()} {companyName}</p>}
      </footer>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40 safe-area-bottom">
        <div className="flex justify-around items-center">
          {tabs.map((tab) => {
            const active = location.pathname === tab.path;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={`flex flex-col items-center gap-0.5 py-2 px-1 min-w-0 flex-1 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <tab.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium truncate w-full text-center">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default PortalLayout;
