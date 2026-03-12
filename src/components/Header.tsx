import { useNavigation, type Page } from "@/hooks/useNavigation";
import { Search, Bell, User, Loader2, CheckCheck, Building2 } from "lucide-react";
import { useCompanySwitcher } from "@/hooks/useCompanySwitcher";
import { useState, useEffect, useRef, useCallback } from "react";
import vakflowLogo from "@/assets/vakflow-logo.svg";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { useIndustryConfig } from "@/hooks/useIndustryConfig";
import { SidebarTrigger } from "@/components/ui/sidebar";

const Header = () => {
  const { currentPage, navigate } = useNavigation();
  const { companyLogoUrl } = useAuth();
  const { labels } = useIndustryConfig();

  const pageTitles: Record<Page, { title: string; sub: string }> = {
    dashboard: { title: "Dashboard", sub: "Overzicht van vandaag" },
    planning: { title: "Planning", sub: "Weekoverzicht" },
    customers: { title: "Klanten", sub: "Klantenoverzicht" },
    custCreate: { title: "Nieuwe klant", sub: "Klant toevoegen" },
    custDetail: { title: "Klantdetail", sub: "Klantinformatie" },
    workorders: { title: labels.workOrders, sub: `Alle ${labels.workOrders.toLowerCase()}` },
    woDetail: { title: labels.workOrder, sub: `${labels.workOrder}details` },
    invoices: { title: "Facturatie", sub: "Factuuroverzicht" },
    quotes: { title: "Offertes", sub: "Offerteoverzicht" },
    reports: { title: "Rapportages", sub: "KPI's & inzichten" },
    communication: { title: "Logboek", sub: "Telefoon & notities" },
    email: { title: "E-mail", sub: "Inbox & verzonden" },
    whatsapp: { title: "WhatsApp", sub: "Gesprekken" },
    reminders: { title: "Reminders", sub: "Herinneringen" },
    assets: { title: labels.assets, sub: `${labels.asset}beheer` },
    vehicles: { title: labels.vehicles, sub: `${labels.vehicle}beheer` },
    vehDetail: { title: labels.vehicle, sub: `${labels.vehicle}dossier` },
    contracts: { title: "Contracten", sub: "Terugkerende contracten" },
    marketing: { title: "Marketing", sub: "Meta leads & berichten" },
    trade: { title: "Inruil & Verkoop", sub: "Inruilvoertuigen & marges" },
    schedule: { title: "Te plannen", sub: "Objecten inplannen" },
    settings: { title: "Instellingen", sub: "Profiel & voorkeuren" },
    audits: { title: "Kwaliteit", sub: "Audits & naleving" },
    projects: { title: "Projecten", sub: "Projectoverzicht" },
    projDetail: { title: "Project", sub: "Projectdetails" },
    leads: { title: "Leads", sub: "Leadbeheer" },
    accounting: { title: "Boekhouding", sub: "Boekhoudkoppeling beheren" },
    superadmin: { title: "Super Admin", sub: "Bedrijvenbeheer" },
  };

  const info = pageTitles[currentPage];
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  const extraPages: { id: Page; label: string }[] = [
    { id: "email", label: "E-mail" },
    { id: "whatsapp", label: "WhatsApp" },
    { id: "communication", label: "Logboek" },
    { id: "reminders", label: "Reminders" },
    { id: "settings", label: "Instellingen" },
  ];

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const doSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    setSearchLoading(true);
    try {
      const pattern = `%${query}%`;
      const [custRes, woRes] = await Promise.all([
        supabase.from("customers").select("id, name, city").ilike("name", pattern).limit(5),
        supabase.from("work_orders").select("id, work_order_number, customers(name)").or(`work_order_number.ilike.${pattern}`).limit(5),
      ]);
      const results: SearchResult[] = [];
      custRes.data?.forEach((c) => results.push({ type: "customer", id: c.id, label: c.name, sub: c.city || "" }));
      woRes.data?.forEach((w) => results.push({ type: "workorder", id: w.id, label: w.work_order_number || labels.workOrder, sub: (w.customers as any)?.name || "" }));
      setSearchResults(results);
      setSearchOpen(results.length > 0);
    } catch {
      setSearchResults([]);
    }
    setSearchLoading(false);
  }, [labels.workOrder]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  const handleResultClick = (result: SearchResult) => {
    if (result.type === "customer") {
      navigate("custDetail", { customerId: result.id });
    } else {
      navigate("woDetail", { workOrderId: result.id });
    }
    setSearchQuery("");
    setSearchOpen(false);
  };

  const handleNotificationClick = (n: typeof notifications[0]) => {
    if (!n.read) markRead.mutate(n.id);
    if (n.link_page) {
      navigate(n.link_page as Page, n.link_params as any);
    }
  };

  return (
    <header className="min-h-[58px] bg-card border-b border-border flex items-center px-4 md:px-5 lg:px-6 gap-3.5 flex-shrink-0 safe-top">
      <SidebarTrigger className="hidden lg:flex" />
      {companyLogoUrl ? (
        <img src={companyLogoUrl} alt="Logo" className="h-7 max-w-[120px] object-contain flex-shrink-0 lg:hidden" />
      ) : (
        <div className="bg-foreground rounded px-2 py-1 flex-shrink-0 lg:hidden">
          <img src={vakflowLogo} alt="Vakflow" className="h-5 object-contain" />
        </div>
      )}
      <div className="min-w-0">
        <h1 className="text-base md:text-lg font-extrabold tracking-tight truncate">{info.title}</h1>
        <p className="text-[11px] md:text-[12.5px] text-t3 font-medium hidden md:block">{info.sub}</p>
      </div>
      <div className="flex-1" />

      {/* Search */}
      <div className="relative hidden md:block" ref={searchRef}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-t3" />
        {searchLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-t3 animate-spin" />}
        <input
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
          placeholder={`Zoek klant, ${labels.workOrder.toLowerCase()}...`}
          className="pl-9 w-40 md:w-60 bg-background border border-border rounded-sm py-2 px-3.5 text-[13px] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary-muted"
        />
        {searchOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-md z-50 overflow-hidden">
            {searchResults.map((r) => (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => handleResultClick(r)}
                className="w-full text-left px-4 py-2.5 text-[13px] hover:bg-bg-hover transition-colors flex items-center gap-2"
              >
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${r.type === "customer" ? "bg-primary-muted text-primary" : "bg-cyan-muted text-cyan"}`}>
                  {r.type === "customer" ? "Klant" : "WB"}
                </span>
                <span className="font-semibold whitespace-nowrap">{r.label}</span>
                {r.sub && <span className="text-t3 text-[11px] ml-auto truncate">{r.sub}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Notifications */}
      <Popover>
        <PopoverTrigger asChild>
          <button className="w-9 h-9 flex items-center justify-center rounded-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors relative">
            <Bell className="w-[18px] h-[18px]" strokeWidth={2} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0 max-h-[420px] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-bold">Notificaties</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="text-[11px] text-primary hover:underline flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Alles gelezen
              </button>
            )}
          </div>
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                Geen notificaties
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full text-left px-4 py-3 border-b border-border last:border-0 transition-colors hover:bg-secondary ${!n.read ? "bg-primary/[0.04]" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                    <div className={`min-w-0 ${n.read ? "ml-4" : ""}`}>
                      <p className="text-[13px] font-semibold truncate">{n.title}</p>
                      {n.body && <p className="text-[12px] text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>}
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: nl })}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Profile icon – mobile only */}
      <div className="relative lg:hidden">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-primary/10 text-primary transition-colors"
          aria-label="Profiel menu"
        >
          <User className="w-[18px] h-[18px]" strokeWidth={2} />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-11 z-50 bg-card border border-border rounded-lg shadow-md py-1.5 min-w-[180px] animate-page-in">
              {extraPages.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { navigate(p.id); setMenuOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-[13px] font-semibold transition-colors ${
                    currentPage === p.id ? "text-primary bg-primary/10" : "text-secondary-foreground hover:bg-secondary"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </header>
  );
};

interface SearchResult {
  type: "customer" | "workorder";
  id: string;
  label: string;
  sub: string;
}

export default Header;
