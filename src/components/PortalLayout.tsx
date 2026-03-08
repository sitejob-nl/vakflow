import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { FileText, Wrench, LogOut, User, Car, CalendarPlus } from "lucide-react";
import vakflowLogo from "@/assets/vakflow-logo.svg";

const PortalLayout = () => {
  const { customerName, companyName, companyLogoUrl, signOut } = usePortalAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const tabs = [
    { path: "/portal/quotes", label: "Offertes", icon: FileText },
    { path: "/portal/workorders", label: "Werkbonnen", icon: Wrench },
    { path: "/portal/appointments", label: "Afspraken", icon: CalendarPlus },
    { path: "/portal/vehicles", label: "Voertuigen", icon: Car },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <img
            src={companyLogoUrl || vakflowLogo}
            alt="Logo"
            className="h-8 object-contain"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{companyName ?? "Klantportaal"}</p>
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
              <User className="h-3 w-3" />
              {customerName ?? "Klant"}
            </p>
          </div>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Uitloggen</span>
          </button>
        </div>
        {/* Tab nav */}
        <div className="max-w-5xl mx-auto px-4">
          <nav className="flex gap-1">
            {tabs.map((tab) => {
              const active = location.pathname === tab.path;
              return (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
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
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
};

export default PortalLayout;
