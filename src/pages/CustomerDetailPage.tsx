import { useNavigation } from "@/hooks/useNavigation";
import { useCustomer, useDeleteCustomer } from "@/hooks/useCustomers";
import { useWorkOrders } from "@/hooks/useWorkOrders";
import { useInvoices } from "@/hooks/useInvoices";
import { useAddresses, useDeleteAddress, type Address } from "@/hooks/useAddresses";
import { useCommunicationLogs } from "@/hooks/useCommunicationLogs";
import { useAuth } from "@/contexts/AuthContext";
import { useIndustryConfig } from "@/hooks/useIndustryConfig";
import AddressDialog from "@/components/AddressDialog";
import WhatsAppChat from "@/components/WhatsAppChat";
import CustomerEmailTab from "@/components/CustomerEmailTab";
import { Loader2, Trash2, MapPin, Plus, MessageSquare } from "lucide-react";
import { useState, useMemo } from "react";
import CustomerDialog from "@/components/CustomerDialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const typeMap: Record<string, string> = {
  particulier: "Particulier",
  zakelijk: "Zakelijk",
  vve: "VvE",
};

const statusBadge: Record<string, string> = {
  open: "bg-cyan-muted text-cyan",
  bezig: "bg-warning-muted text-warning",
  afgerond: "bg-success-muted text-success",
};

const invoiceStatusBadge: Record<string, string> = {
  concept: "bg-cyan-muted text-cyan",
  verzonden: "bg-warning-muted text-warning",
  betaald: "bg-success-muted text-success",
  verlopen: "bg-destructive-muted text-destructive",
};

const CustomerDetailPage = () => {
  const { navigate, params } = useNavigation();
  const { toast } = useToast();
  const { labels } = useIndustryConfig();
  const { data: customer, isLoading } = useCustomer(params.customerId);
  const { data: allWorkOrders } = useWorkOrders();
  const { data: allInvoices } = useInvoices();
  const deleteCustomer = useDeleteCustomer();
  const { data: addresses } = useAddresses(params.customerId);
  const { companyId } = useAuth();
  const { data: commLogs } = useCommunicationLogs(params.customerId, companyId);
  const deleteAddress = useDeleteAddress();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  const isBusinessCustomer = customer?.type === "zakelijk" || customer?.type === "vve";

  const customerWorkOrders = useMemo(
    () => allWorkOrders?.filter((wo) => wo.customer_id === params.customerId) ?? [],
    [allWorkOrders, params.customerId]
  );

  const customerInvoices = useMemo(
    () => allInvoices?.filter((inv) => inv.customer_id === params.customerId) ?? [],
    [allInvoices, params.customerId]
  );

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!customer) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Klant niet gevonden</p>
        <button onClick={() => navigate("customers")} className="mt-4 text-primary text-sm font-bold hover:underline">Terug naar klanten</button>
      </div>
    );
  }

  const getInitials = (name: string) =>
    name.split(/[\s.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  const getAvatarColor = (type: string) => {
    if (type === "zakelijk") return "bg-accent-muted text-accent";
    if (type === "vve") return "bg-purple-muted text-purple";
    return "bg-primary-muted text-primary";
  };

  const handleDelete = async () => {
    try {
      await deleteCustomer.mutateAsync(customer.id);
      toast({ title: "Klant verwijderd" });
      navigate("customers");
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const tabLabels = isBusinessCustomer
    ? [labels.workOrders, "Facturen", "E-mail", "WhatsApp", "Communicatie", "Panden"]
    : [labels.workOrders, "Facturen", "E-mail", "WhatsApp", "Communicatie"];

  const tabContent = [
    // Werkbonnen
    () => customerWorkOrders.length === 0 ? (
      <div className="text-center py-12 text-muted-foreground text-sm">Nog geen {labels.workOrders.toLowerCase()} voor deze klant.</div>
    ) : (
      <>
        {/* Desktop table */}
        <table className="w-full hidden md:table">
          <thead>
            <tr className="bg-background">
              {["Nummer", "Dienst", "Status", "Datum"].map((h) => (
                <th key={h} className="text-left px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-wider text-t3 border-b border-border">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {customerWorkOrders.map((wo) => (
              <tr key={wo.id} onClick={() => navigate("woDetail", { workOrderId: wo.id })} className="hover:bg-bg-hover transition-colors cursor-pointer">
                <td className="px-5 py-3 text-[12px] font-mono">{wo.work_order_number ?? "—"}</td>
                <td className="px-5 py-3 text-[13.5px]">{(wo as any).services?.name ?? "—"}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex px-2.5 py-[3px] rounded-full text-[11px] font-bold ${statusBadge[wo.status] ?? statusBadge.open}`}>
                    {wo.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-[12px] font-mono">{format(new Date(wo.created_at), "dd-MM-yyyy")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-border">
          {customerWorkOrders.map((wo) => (
            <div key={wo.id} onClick={() => navigate("woDetail", { workOrderId: wo.id })} className="px-4 py-3 flex items-center gap-3 active:bg-bg-hover cursor-pointer">
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold truncate">{(wo as any).services?.name ?? "—"}</div>
                <div className="text-[11px] text-t3 font-mono">{wo.work_order_number ?? "—"} · {format(new Date(wo.created_at), "dd-MM-yyyy")}</div>
              </div>
              <span className={`inline-flex px-2.5 py-[3px] rounded-full text-[11px] font-bold flex-shrink-0 ${statusBadge[wo.status] ?? statusBadge.open}`}>{wo.status}</span>
            </div>
          ))}
        </div>
      </>
    ),
    // E-mail tab
    () => (
      <CustomerEmailTab
        customerId={customer.id}
        customerEmail={customer.email}
        customerName={customer.name}
      />
    ),
    // Facturen
    () => customerInvoices.length === 0 ? (
      <div className="text-center py-12 text-muted-foreground text-sm">Nog geen facturen voor deze klant.</div>
    ) : (
      <>
        <table className="w-full hidden md:table">
          <thead>
            <tr className="bg-background">
              {["Nummer", "Bedrag", "Status", "Datum"].map((h) => (
                <th key={h} className="text-left px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-wider text-t3 border-b border-border">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {customerInvoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-bg-hover transition-colors">
                <td className="px-5 py-3 text-[12px] font-mono">{inv.invoice_number ?? "—"}</td>
                <td className="px-5 py-3 font-mono">€ {Number(inv.total).toFixed(2)}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex px-2.5 py-[3px] rounded-full text-[11px] font-bold ${invoiceStatusBadge[inv.status] ?? invoiceStatusBadge.concept}`}>{inv.status}</span>
                </td>
                <td className="px-5 py-3 text-[12px] font-mono">{inv.issued_at ? format(new Date(inv.issued_at), "dd-MM-yyyy") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="md:hidden divide-y divide-border">
          {customerInvoices.map((inv) => (
            <div key={inv.id} className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold">€ {Number(inv.total).toFixed(2)}</div>
                <div className="text-[11px] text-t3 font-mono">{inv.invoice_number ?? "—"} · {inv.issued_at ? format(new Date(inv.issued_at), "dd-MM-yyyy") : "—"}</div>
              </div>
              <span className={`inline-flex px-2.5 py-[3px] rounded-full text-[11px] font-bold flex-shrink-0 ${invoiceStatusBadge[inv.status] ?? invoiceStatusBadge.concept}`}>{inv.status}</span>
            </div>
          ))}
        </div>
      </>
    ),
    // WhatsApp Chat
    () => (
      <WhatsAppChat
        customerId={customer.id}
        customerPhone={customer.phone}
        customerName={customer.name}
      />
    ),
    // Communicatie
    () => !commLogs?.length ? (
      <div className="text-center py-12 text-muted-foreground text-sm">Nog geen berichten voor deze klant.</div>
    ) : (
      <div className="px-4 py-3">
        <div className="relative pl-[26px]">
          <div className="absolute left-[8px] top-[8px] bottom-[8px] w-[2px] bg-border" />
          {commLogs.map((m) => {
            const dt = m.sent_at ?? m.created_at;
            const iconMap: Record<string, string> = { email: "📧", whatsapp: "💬", telefoon: "📞", notitie: "📝", review: "⭐" };
            const dotMap: Record<string, string> = { email: "border-primary bg-primary-muted", whatsapp: "border-accent bg-accent-muted", telefoon: "border-warning bg-warning-muted", notitie: "border-muted-foreground bg-muted", review: "border-purple bg-purple-muted" };
            const tagMap: Record<string, string> = { email: "bg-primary-muted text-primary", whatsapp: "bg-accent-muted text-accent", telefoon: "bg-warning-muted text-warning", notitie: "bg-muted text-muted-foreground", review: "bg-purple-muted text-purple" };
            const channelLabel: Record<string, string> = { email: "E-mail", whatsapp: "WhatsApp", telefoon: "Telefoon", notitie: "Notitie", review: "Review" };
            const autoLabel = m.is_automated ? "Auto" : "Handmatig";
            return (
              <div key={m.id} className="relative py-[11px]">
                <div className={`absolute -left-[22px] top-[16px] w-3 h-3 rounded-full border-2 ${dotMap[m.channel] ?? "border-muted-foreground bg-muted"}`} />
                <div className="text-[10px] md:text-[11px] text-t3 font-mono">{format(new Date(dt), "dd-MM-yyyy HH:mm", { locale: nl })}</div>
                {m.subject && <div className="text-[12px] md:text-[13px] font-bold mt-1 mb-0.5">{m.subject}</div>}
                {m.body && <div className="text-[11.5px] md:text-[12.5px] text-secondary-foreground">{m.body}</div>}
                <span className={`inline-block text-[9px] md:text-[10px] font-bold px-2 py-[2px] rounded-[10px] mt-1 ${tagMap[m.channel] ?? "bg-muted text-muted-foreground"}`}>
                  {iconMap[m.channel] ?? "📄"} {channelLabel[m.channel] ?? m.channel} · {m.direction === "inbound" ? "Inkomend" : autoLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    ),
    // Panden
    () => (
      <div>
        <div className="px-4 md:px-5 py-3 md:py-4 flex items-center justify-between border-b border-border">
          <h3 className="text-[14px] md:text-[15px] font-bold">Panden / Objecten</h3>
          <button
            onClick={() => { setEditingAddress(null); setAddressDialogOpen(true); }}
            className="px-2.5 md:px-3 py-1.5 bg-primary text-primary-foreground rounded-sm text-[11px] md:text-[12px] font-bold hover:bg-primary-hover transition-colors flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Toevoegen
          </button>
        </div>
        {!addresses?.length ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Nog geen panden/adressen voor deze klant.</div>
        ) : (
          <div className="divide-y divide-border">
            {addresses.map((addr) => (
              <div key={addr.id} className="px-4 md:px-5 py-3 md:py-4 hover:bg-bg-hover transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 md:gap-3 min-w-0">
                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-primary-muted text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] md:text-[13.5px] font-bold truncate">
                        {[addr.street, addr.house_number].filter(Boolean).join(" ")}
                        {addr.apartment ? ` ${addr.apartment}` : ""}
                      </p>
                      <p className="text-[11px] md:text-[12px] text-t3">
                        {[addr.postal_code, addr.city].filter(Boolean).join(" ")}
                      </p>
                      {addr.notes && <p className="text-[11px] md:text-[12px] text-secondary-foreground mt-1">{addr.notes}</p>}
                      {addr.last_service_date && (
                        <p className="text-[10px] md:text-[11px] text-t3 mt-1">Laatste service: {format(new Date(addr.last_service_date), "dd-MM-yyyy")}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => { setEditingAddress(addr); setAddressDialogOpen(true); }}
                      className="px-2 md:px-2.5 py-1 bg-card border border-border rounded-sm text-[10px] md:text-[11px] font-bold text-secondary-foreground hover:bg-bg-hover transition-colors"
                    >
                      Bewerken
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await deleteAddress.mutateAsync({ id: addr.id, customer_id: customer.id });
                          toast({ title: "Adres verwijderd" });
                        } catch (err: any) {
                          toast({ title: "Fout", description: err.message, variant: "destructive" });
                        }
                      }}
                      className="px-1.5 md:px-2 py-1 bg-card border border-destructive text-destructive rounded-sm text-[10px] md:text-[11px] font-bold hover:bg-destructive-muted transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    ),
  ];

  return (
    <div>
      <button onClick={() => navigate("customers")} className="mb-3 md:mb-4 px-3 py-1.5 text-[12px] font-semibold text-t3 hover:text-foreground hover:bg-bg-hover rounded-sm transition-colors">
        ← Terug naar klanten
      </button>

      {/* Customer info card + details stacked on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-[310px_1fr] gap-4 md:gap-6">
        {/* Left */}
        <div>
          <div className="bg-card border border-border rounded-lg p-4 md:p-6 text-center shadow-card">
            <div className={`w-[50px] h-[50px] md:w-[60px] md:h-[60px] rounded-2xl flex items-center justify-center font-extrabold text-lg md:text-xl mx-auto mb-2 md:mb-3 ${getAvatarColor(customer.type)}`}>
              {getInitials(customer.name)}
            </div>
            <h2 className="text-base md:text-lg font-extrabold mb-0.5 md:mb-1">{customer.name}</h2>
            <p className="text-[12px] md:text-[13px] text-secondary-foreground">
              {typeMap[customer.type] ?? customer.type} · {customer.city || "Onbekend"}
            </p>
            <div className="mt-3 md:mt-4 flex gap-2 justify-center">
              <button onClick={() => setEditOpen(true)} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-sm text-[12px] font-bold hover:bg-primary-hover transition-colors">
                Bewerken
              </button>
              <button onClick={() => setDeleteOpen(true)} className="px-3 py-1.5 bg-card border border-destructive text-destructive rounded-sm text-[12px] font-bold hover:bg-destructive-muted transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg shadow-card mt-3 md:mt-4 overflow-hidden">
            <div className="px-4 py-3 md:py-3.5 border-b border-border"><h3 className="text-[13px] md:text-sm font-bold">Klantgegevens</h3></div>
            <div className="px-4 py-3">
              {[
                ["Contact", customer.contact_person || "—"],
                ["Telefoon", customer.phone || "—"],
                ["E-mail", customer.email || "—"],
                ["Adres", [customer.address, customer.postal_code, customer.city].filter(Boolean).join(", ") || "—"],
                ["Interval", `${customer.interval_months} maanden`],
                ["Dienst", (customer as any).services?.name || "—"],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between py-1.5 md:py-2 border-b border-border last:border-b-0 text-[12px] md:text-[13px]">
                  <span className="text-t3 font-medium">{l}</span>
                  <span className="font-semibold text-right max-w-[55%] truncate">{v}</span>
                </div>
              ))}
              <div className="flex justify-between py-1.5 md:py-2 text-[12px] md:text-[13px]">
                <span className="text-t3 font-medium">WhatsApp opt-in</span>
                <span className={`font-semibold ${customer.whatsapp_optin ? "text-accent" : "text-t3"}`}>
                  {customer.whatsapp_optin ? "✓ Ja" : "Nee"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right — tabs */}
        <div>
          <div className="flex gap-0 border-b-2 border-border mb-4 md:mb-5 overflow-x-auto scrollbar-hide">
            {tabLabels.map((t, i) => (
              <button key={t} onClick={() => setActiveTab(i)} className={`px-3.5 md:px-5 py-2.5 text-[12px] md:text-[13px] font-bold border-b-2 -mb-[2px] transition-colors whitespace-nowrap ${i === activeTab ? "text-primary border-primary" : "text-t3 border-transparent hover:text-secondary-foreground"}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
            {tabContent[activeTab]()}
          </div>
        </div>
      </div>

      <CustomerDialog open={editOpen} onOpenChange={setEditOpen} customer={customer} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Klant verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je "{customer.name}" wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {customer && (
        <AddressDialog
          open={addressDialogOpen}
          onOpenChange={setAddressDialogOpen}
          customerId={customer.id}
          address={editingAddress}
        />
      )}
    </div>
  );
};

export default CustomerDetailPage;
