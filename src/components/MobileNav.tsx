import { forwardRef, useState } from "react";
import { useNavigation, type Page } from "@/hooks/useNavigation";
import {
  LayoutGrid, Calendar, Users, FileText, DollarSign, Mail, MessageSquare,
  MoreHorizontal, X, RefreshCw, BarChart3, Box, Car, Bell, Megaphone,
  Repeat, CalendarCheck, ClipboardCheck, FolderKanban, Settings
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useIndustryConfig } from "@/hooks/useIndustryConfig";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface NavItem {
  id: Page;
  icon: typeof LayoutGrid;
  label: string;
  adminOnly: boolean;
}

const buildPrimaryItems = (workOrderLabel: string): NavItem[] => [
  { id: "dashboard", icon: LayoutGrid, label: "Home", adminOnly: false },
  { id: "planning", icon: Calendar, label: "Planning", adminOnly: false },
  { id: "workorders", icon: FileText, label: workOrderLabel, adminOnly: false },
  { id: "customers", icon: Users, label: "Klanten", adminOnly: true },
];

const buildAllItems = (labels: { workOrders: string; assets: string; vehicles: string }, industry: string): { section: string; items: NavItem[] }[] => [
  {
    section: "Operatie",
    items: [
      { id: "dashboard", icon: LayoutGrid, label: "Dashboard", adminOnly: false },
      { id: "planning", icon: Calendar, label: "Planning", adminOnly: false },
      { id: "customers", icon: Users, label: "Klanten", adminOnly: true },
      { id: "projects", icon: FolderKanban, label: "Projecten", adminOnly: true },
      { id: "workorders", icon: FileText, label: labels.workOrders, adminOnly: false },
      { id: "schedule", icon: CalendarCheck, label: "Te plannen", adminOnly: false },
      { id: "contracts", icon: RefreshCw, label: "Contracten", adminOnly: true },
    ],
  },
  {
    section: "Administratie",
    items: [
      { id: "invoices", icon: DollarSign, label: "Facturatie", adminOnly: true },
      { id: "quotes", icon: FileText, label: "Offertes", adminOnly: true },
      { id: "reports", icon: BarChart3, label: "Rapportages", adminOnly: true },
      { id: "email", icon: Mail, label: "E-mail", adminOnly: true },
      { id: "whatsapp", icon: MessageSquare, label: "WhatsApp", adminOnly: true },
      { id: "reminders", icon: Bell, label: "Reminders", adminOnly: true },
    ],
  },
  {
    section: "Beheer",
    items: [
      { id: "assets", icon: Box, label: labels.assets, adminOnly: true },
      ...(industry === "cleaning" ? [{ id: "audits" as Page, icon: ClipboardCheck, label: "Kwaliteit", adminOnly: true }] : []),
      { id: "vehicles", icon: Car, label: labels.vehicles, adminOnly: true },
      ...(industry === "automotive" ? [{ id: "trade" as Page, icon: Repeat, label: "Inruil & Verkoop", adminOnly: true }] : []),
      { id: "marketing", icon: Megaphone, label: "Marketing", adminOnly: true },
      { id: "settings", icon: Settings, label: "Instellingen", adminOnly: true },
    ],
  },
];

const MobileNav = forwardRef<HTMLElement>((_props, ref) => {
  const { currentPage, navigate } = useNavigation();
  const { isAdmin, enabledFeatures } = useAuth();
  const { labels, industry, config } = useIndustryConfig();
  const [moreOpen, setMoreOpen] = useState(false);

  const industryModules = config.modules;

  const filterItem = (item: NavItem) =>
    (!item.adminOnly || isAdmin) &&
    industryModules.includes(item.id) &&
    (enabledFeatures.length === 0 || enabledFeatures.includes(item.id) || item.id === "accounting");

  const primaryItems = buildPrimaryItems(labels.workOrders).filter(filterItem);
  const allSections = buildAllItems(labels, industry).map((s) => ({
    ...s,
    items: s.items.filter(filterItem),
  })).filter((s) => s.items.length > 0);

  const isActive = (id: Page) =>
    currentPage === id ||
    (id === "customers" && currentPage === "custDetail") ||
    (id === "workorders" && currentPage === "woDetail") ||
    (id === "vehicles" && currentPage === "vehDetail") ||
    (id === "projects" && currentPage === "projDetail");

  const handleNavigate = (page: Page) => {
    navigate(page);
    setMoreOpen(false);
  };

  return (
    <>
      <nav ref={ref} className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border safe-bottom">
        <div className="flex items-center justify-around h-[60px] px-1">
          {primaryItems.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-[56px] ${
                isActive(item.id) ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <item.icon className="w-5 h-5" strokeWidth={isActive(item.id) ? 2.2 : 1.8} />
              <span className="text-[10px] font-semibold">{item.label}</span>
            </button>
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-[56px] ${
              moreOpen ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <MoreHorizontal className="w-5 h-5" strokeWidth={1.8} />
            <span className="text-[10px] font-semibold">Meer</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[70vh] rounded-t-2xl pb-20">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-left text-base">Navigatie</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto space-y-4">
            {allSections.map((section) => (
              <div key={section.section}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                  {section.section}
                </p>
                <div className="grid grid-cols-4 gap-1">
                  {section.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleNavigate(item.id)}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl transition-colors ${
                        isActive(item.id)
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      <item.icon className="w-5 h-5" strokeWidth={isActive(item.id) ? 2.2 : 1.6} />
                      <span className="text-[11px] font-medium leading-tight text-center">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
});

MobileNav.displayName = "MobileNav";

export default MobileNav;
