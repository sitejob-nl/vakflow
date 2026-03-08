import { useState, useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CustomerCombobox from "@/components/CustomerCombobox";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, Navigation, MapPin, ExternalLink, Plus, AlertTriangle, Car, ChevronDown, Truck } from "lucide-react";
import { useCreateAppointment, useUpdateAppointment, useAppointmentsForDay } from "@/hooks/useAppointments";
import { useCustomers } from "@/hooks/useCustomers";
import { useServices } from "@/hooks/useCustomers";
import { useAddresses } from "@/hooks/useAddresses";
import { useCustomerVehicles } from "@/hooks/useVehicles";
import { useIndustryConfig } from "@/hooks/useIndustryConfig";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useDirections } from "@/hooks/useMapbox";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import CustomerDialog from "@/components/CustomerDialog";
import ServiceDialog from "@/components/ServiceDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment?: Tables<"appointments"> | null;
  defaultDate?: Date;
  prefill?: { customer_id?: string; notes?: string };
  projectId?: string;
}

const statusOptions = [
  { value: "gepland", label: "Gepland" },
  { value: "onderweg", label: "Onderweg" },
  { value: "bezig", label: "Bezig" },
  { value: "afgerond", label: "Afgerond" },
  { value: "geannuleerd", label: "Geannuleerd" },
];

const FALLBACK_START: [number, number] = [52.507, 4.678];
const FALLBACK_START_LABEL = "Heemskerk (standaard)";

const AppointmentDialog = ({ open, onOpenChange, appointment, defaultDate, prefill, projectId }: Props) => {
  const { toast } = useToast();
  const { user, companyId } = useAuth();
  const { industry } = useIndustryConfig();
  const isAutomotive = industry === "automotive";
  const { data: customers } = useCustomers();
  const { data: services } = useServices();
  const createAppointment = useCreateAppointment();
  const updateAppointment = useUpdateAppointment();
  const { result: travelInfo, loading: travelLoading, calculate: calcTravel } = useDirections();
  const isDuplicate = appointment?.id === "__duplicate__";
  const isEdit = !!appointment && !isDuplicate;

  // Fetch company address as default start location
  const defaultStartRef = useRef<{ coords: [number, number]; label: string }>({
    coords: FALLBACK_START,
    label: FALLBACK_START_LABEL,
  });
  const [defaultStartLoaded, setDefaultStartLoaded] = useState(false);

  useEffect(() => {
    if (!user?.id || defaultStartLoaded) return;
    let cancelled = false;
    (async () => {
      // First try profile location
      const { data: profile } = await supabase
        .from("profiles")
        .select("location")
        .eq("id", user.id)
        .maybeSingle();
      const loc = profile?.location;

      // If no profile location, try company address
      let addressToGeocode = loc;
      let addressLabel = loc;
      if (!loc && companyId) {
        const { data: company } = await supabase
          .from("companies_safe")
          .select("address, city, postal_code, name")
          .eq("id", companyId)
          .maybeSingle();
        if (company?.address) {
          addressToGeocode = [company.address, company.postal_code, company.city].filter(Boolean).join(", ");
          addressLabel = company.name ? `${company.name} (bedrijf)` : addressToGeocode;
        }
      }

      if (!addressToGeocode || cancelled) { setDefaultStartLoaded(true); return; }

      const { data } = await supabase.functions.invoke("google-maps-proxy", {
        body: { action: "geocode", query: addressToGeocode },
      });
      if (cancelled) return;
      const first = data?.[0];
      if (first?.lat && first?.lng) {
        defaultStartRef.current = {
          coords: [first.lat, first.lng],
          label: addressLabel || addressToGeocode,
        };
      }
      setDefaultStartLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [user?.id, companyId, defaultStartLoaded]);

  const DEFAULT_START = defaultStartRef.current.coords;
  const DEFAULT_START_LABEL = defaultStartRef.current.label;

  const assignedTo = appointment?.assigned_to || user?.id || null;
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const isMobile = useIsMobile();
  const [routeOpen, setRouteOpen] = useState(!isAutomotive);

  const formatDateTimeLocal = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [form, setForm] = useState({
    customer_id: "",
    service_id: "",
    address_id: "",
    vehicle_id: "",
    scheduled_at: "",
    duration_minutes: 60,
    status: "gepland",
    notes: "",
    delivery_type: "gebracht",
    pickup_address: "",
    pickup_lat: null as number | null,
    pickup_lng: null as number | null,
  });

  const { data: customerVehicles } = useCustomerVehicles(isAutomotive && form.customer_id ? form.customer_id : undefined);
  const { data: customerAddresses } = useAddresses(form.customer_id || undefined);

  const [startLocationLabel, setStartLocationLabel] = useState(DEFAULT_START_LABEL);
  const [startCoords, setStartCoords] = useState<[number, number]>(DEFAULT_START);

  const formDate = useMemo(() => {
    if (!form.scheduled_at) return null;
    const d = new Date(form.scheduled_at);
    return isNaN(d.getTime()) ? null : d;
  }, [form.scheduled_at]);

  const { data: dayAppointments } = useAppointmentsForDay(formDate, assignedTo);

  const previousAppointment = useMemo(() => {
    if (!dayAppointments || !formDate) return null;
    const currentTime = formDate.getTime();
    const earlier = dayAppointments
      .filter((a) => {
        if (appointment && a.id === appointment.id) return false;
        return new Date(a.scheduled_at).getTime() < currentTime;
      })
      .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
    return earlier[0] ?? null;
  }, [dayAppointments, formDate, appointment]);

  const conflicts = useMemo(() => {
    if (!dayAppointments || !formDate || !form.duration_minutes) return [];
    const startMs = formDate.getTime();
    const endMs = startMs + form.duration_minutes * 60 * 1000;
    return dayAppointments.filter((a) => {
      if (appointment && a.id === appointment.id) return false;
      const aStart = new Date(a.scheduled_at).getTime();
      const aEnd = aStart + (a.duration_minutes ?? 60) * 60 * 1000;
      return startMs < aEnd && endMs > aStart;
    });
  }, [dayAppointments, formDate, form.duration_minutes, appointment]);

  useEffect(() => {
    if (appointment) {
      const scheduledAt = isDuplicate && defaultDate
        ? formatDateTimeLocal(defaultDate)
        : formatDateTimeLocal(new Date(appointment.scheduled_at));
      setForm({
        customer_id: appointment.customer_id,
        service_id: appointment.service_id || "",
        address_id: appointment.address_id || "",
        vehicle_id: (appointment as any).vehicle_id || "",
        scheduled_at: scheduledAt,
        duration_minutes: appointment.duration_minutes ?? 60,
        status: isDuplicate ? "gepland" : appointment.status,
        notes: appointment.notes || "",
        delivery_type: (appointment as any).delivery_type || "gebracht",
        pickup_address: (appointment as any).pickup_address || "",
        pickup_lat: (appointment as any).pickup_lat || null,
        pickup_lng: (appointment as any).pickup_lng || null,
      });
      setStartLocationLabel((appointment as any).start_location_label || DEFAULT_START_LABEL);
      // Open route section if delivery_type is ophalen
      if ((appointment as any).delivery_type === "ophalen") setRouteOpen(true);
    } else {
      const dt = defaultDate ?? new Date();
      setForm({
        customer_id: prefill?.customer_id || "",
        service_id: "",
        address_id: "",
        vehicle_id: "",
        scheduled_at: formatDateTimeLocal(dt),
        duration_minutes: 60,
        status: "gepland",
        notes: prefill?.notes || "",
        delivery_type: "gebracht",
        pickup_address: "",
        pickup_lat: null,
        pickup_lng: null,
      });
      setStartLocationLabel(DEFAULT_START_LABEL);
      setStartCoords(DEFAULT_START);
      setRouteOpen(!isAutomotive);
    }
  }, [appointment, open, defaultDate, prefill]);

  useEffect(() => {
    if (!previousAppointment) return;
    const c = previousAppointment.customers as any;
    if (c?.lat && c?.lng) {
      setStartCoords([c.lat, c.lng]);
      setStartLocationLabel(`${c.name} — ${c.city || ""}`.trim());
    }
  }, [previousAppointment?.id]);

  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (!form.service_id || !services) return;
    const selected = services.find((s) => s.id === form.service_id);
    if (selected && (selected as any).duration_minutes) {
      setForm((f) => ({ ...f, duration_minutes: (selected as any).duration_minutes }));
    }
  }, [form.service_id, services]);

  // Calculate travel time — for automotive "ophalen", use pickup coords as destination
  useEffect(() => {
    if (isAutomotive && form.delivery_type === "gebracht") return; // no travel calc needed
    
    if (isAutomotive && form.delivery_type === "ophalen") {
      // Use pickup coords
      if (form.pickup_lat && form.pickup_lng && startCoords[0] && startCoords[1]) {
        calcTravel(startCoords, [form.pickup_lat, form.pickup_lng]);
      }
      return;
    }

    // Non-automotive: use customer coords
    if (!form.customer_id || !customers) return;
    const c = customers.find((c) => c.id === form.customer_id);
    const lat = (c as any)?.lat;
    const lng = (c as any)?.lng;
    if (lat && lng && startCoords[0] && startCoords[1]) {
      calcTravel(startCoords, [lat, lng]);
    }
  }, [form.customer_id, customers, startCoords, form.delivery_type, form.pickup_lat, form.pickup_lng, isAutomotive]);

  const handleUsePrevious = () => {
    if (!previousAppointment) return;
    const c = previousAppointment.customers as any;
    if (c?.lat && c?.lng) {
      setStartCoords([c.lat, c.lng]);
      setStartLocationLabel(`${c.name} — ${c.city || ""}`.trim());
    }
  };

  const handleUseDefault = () => {
    setStartCoords(DEFAULT_START);
    setStartLocationLabel(DEFAULT_START_LABEL);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      customer_id: form.customer_id,
      service_id: form.service_id || null,
      address_id: form.address_id || null,
      vehicle_id: form.vehicle_id || null,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      duration_minutes: form.duration_minutes,
      status: form.status,
      notes: form.notes || null,
      travel_time_minutes: travelInfo?.duration_minutes ?? null,
      start_location_label: startLocationLabel || null,
      delivery_type: isAutomotive ? form.delivery_type : null,
      pickup_address: form.delivery_type === "ophalen" ? form.pickup_address || null : null,
      pickup_lat: form.delivery_type === "ophalen" ? form.pickup_lat : null,
      pickup_lng: form.delivery_type === "ophalen" ? form.pickup_lng : null,
      ...(projectId ? { project_id: projectId } : {}),
    };

    try {
      if (isEdit) {
        await updateAppointment.mutateAsync({
          id: appointment!.id,
          ...payload,
          _customers: customers,
          _services: services,
        });
        toast({ title: "Afspraak bijgewerkt" });
      } else {
        await createAppointment.mutateAsync({
          ...payload,
          _customers: customers,
          _services: services,
        });
        toast({ title: "Afspraak aangemaakt" });

        const selectedCustomer = customers?.find((c) => c.id === form.customer_id);
        const selectedService = services?.find((s) => s.id === form.service_id);
        const scheduledDate = new Date(form.scheduled_at);
        try {
          await supabase.functions.invoke("whatsapp-automation-trigger", {
            body: {
              trigger_type: "appointment_created",
              customer_id: form.customer_id,
              context: {
                appointment: {
                  date: scheduledDate.toLocaleDateString("nl-NL"),
                  time: scheduledDate.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }),
                  service: selectedService?.name ?? "",
                },
              },
            },
          });
        } catch {
          // Automation failure shouldn't block appointment creation
        }
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const loading = createAppointment.isPending || updateAppointment.isPending;
  const showRouteSection = !isAutomotive || form.delivery_type === "ophalen";

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-6">
      {/* === Main fields === */}
      <div className="space-y-1.5">
        <Label>Klant *</Label>
        <div className="flex gap-2">
          <CustomerCombobox
            customers={customers}
            value={form.customer_id}
            onValueChange={(v) => set("customer_id", v)}
            className="flex-1"
          />
          <Button type="button" variant="outline" size="icon" className="flex-shrink-0" onClick={() => setCustomerDialogOpen(true)} title="Nieuwe klant">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Dienst</Label>
        <div className="flex gap-2">
          <Select value={form.service_id} onValueChange={(v) => set("service_id", v)}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Kies dienst" /></SelectTrigger>
            <SelectContent>
              {services?.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name} — €{s.price.toFixed(2)} incl.</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="icon" className="flex-shrink-0" onClick={() => setServiceDialogOpen(true)} title="Nieuwe dienst">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Address selector */}
      {customerAddresses && customerAddresses.length > 0 && (
        <div className="space-y-1.5">
          <Label>Werkadres</Label>
          <Select value={form.address_id} onValueChange={(v) => set("address_id", v === "none" ? "" : v)}>
            <SelectTrigger>
              <MapPin className="h-3.5 w-3.5 mr-1 flex-shrink-0 text-muted-foreground" />
              <SelectValue placeholder="Klantadres (standaard)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Klantadres (standaard)</SelectItem>
              {customerAddresses.map((addr) => {
                const line = [addr.street, addr.house_number].filter(Boolean).join(" ");
                const line2 = [addr.postal_code, addr.city].filter(Boolean).join(" ");
                return (
                  <SelectItem key={addr.id} value={addr.id}>
                    {line}{addr.apartment ? ` (${addr.apartment})` : ""}{line2 ? ` — ${line2}` : ""}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Vehicle selector (automotive only) */}
      {isAutomotive && form.customer_id && customerVehicles && customerVehicles.length > 0 && (
        <div className="space-y-1.5">
          <Label>Voertuig</Label>
          <Select value={form.vehicle_id} onValueChange={(v) => set("vehicle_id", v === "none" ? "" : v)}>
            <SelectTrigger>
              <Car className="h-3.5 w-3.5 mr-1 flex-shrink-0 text-muted-foreground" />
              <SelectValue placeholder="Kies voertuig" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Geen voertuig</SelectItem>
              {customerVehicles.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.license_plate}{v.brand ? ` — ${v.brand}` : ""}{v.model ? ` ${v.model}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Datum & tijd *</Label>
          <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => set("scheduled_at", e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Duur (min)</Label>
          <Input type="number" value={form.duration_minutes} onChange={(e) => set("duration_minutes", parseInt(e.target.value) || 60)} min={15} step={15} />
        </div>
      </div>

      {/* === Automotive: delivery type toggle === */}
      {isAutomotive && (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <Label className="text-[13px] font-medium flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5 text-muted-foreground" />
            Voertuig aanlevering
          </Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={form.delivery_type === "gebracht" ? "default" : "outline"}
              size="sm"
              className="flex-1 text-[13px]"
              onClick={() => { set("delivery_type", "gebracht"); setRouteOpen(false); }}
            >
              Wordt gebracht
            </Button>
            <Button
              type="button"
              variant={form.delivery_type === "ophalen" ? "default" : "outline"}
              size="sm"
              className="flex-1 text-[13px]"
              onClick={() => { set("delivery_type", "ophalen"); setRouteOpen(true); }}
            >
              Ophalen
            </Button>
          </div>

          {/* Pickup address (only when ophalen) */}
          {form.delivery_type === "ophalen" && (
            <div className="space-y-1.5 pt-1">
              <Label className="text-[12px]">Ophaaladres</Label>
              <AddressAutocomplete
                value={form.pickup_address}
                onChange={(v) => set("pickup_address", v)}
                onSelect={(fields) => {
                  set("pickup_address", [fields.street, fields.house_number, fields.postal_code, fields.city].filter(Boolean).join(" "));
                  set("pickup_lat", fields.lat);
                  set("pickup_lng", fields.lng);
                }}
                placeholder="Zoek ophaaladres..."
              />
            </div>
          )}
        </div>
      )}

      {/* === Route info (collapsible, hidden for automotive "gebracht") === */}
      {showRouteSection && (
        <Collapsible open={routeOpen} onOpenChange={setRouteOpen}>
          <CollapsibleTrigger asChild>
            <button type="button" className="flex items-center justify-between w-full text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors py-1">
              <span className="flex items-center gap-1.5">
                <Navigation className="h-3.5 w-3.5" /> Route & reistijd
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${routeOpen ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2">
            {/* Start location */}
            <div className="space-y-1.5">
              <Label className="text-[12px]">Startlocatie</Label>
              <AddressAutocomplete
                value={startLocationLabel}
                onChange={setStartLocationLabel}
                onSelect={(fields) => {
                  if (fields.lat && fields.lng) {
                    setStartCoords([fields.lat, fields.lng]);
                    setStartLocationLabel([fields.street, fields.house_number, fields.city].filter(Boolean).join(" "));
                  }
                }}
                placeholder="Zoek startlocatie..."
              />
              <div className="flex gap-2 flex-wrap">
                <Button type="button" variant="outline" size="sm" className="text-[11px] h-7" onClick={handleUseDefault}>
                  <MapPin className="h-3 w-3 mr-1" /> {DEFAULT_START_LABEL}
                </Button>
                {previousAppointment && (
                  <Button type="button" variant="outline" size="sm" className="text-[11px] h-7" onClick={handleUsePrevious}>
                    <Navigation className="h-3 w-3 mr-1" /> Vorige: {(previousAppointment.customers as any)?.name}
                  </Button>
                )}
              </div>
            </div>

            {/* Travel time indicator */}
            {form.customer_id && (() => {
              const selectedCustomer = customers?.find((c) => c.id === form.customer_id);
              return (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted text-[13px]">
                  <Navigation className="h-4 w-4 text-primary flex-shrink-0" />
                  {travelLoading ? (
                    <span className="text-muted-foreground">Reistijd berekenen...</span>
                  ) : travelInfo?.duration_minutes ? (
                    <span>
                      <strong>{travelInfo.duration_minutes} min</strong>
                      <span className="text-muted-foreground ml-1">({travelInfo.distance_km} km)</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Geen coördinaten voor deze klant</span>
                  )}
                  {selectedCustomer?.address && selectedCustomer?.city && (
                    <a
                      href={`https://www.google.com/maps/place/${`${selectedCustomer.address}, ${selectedCustomer.postal_code || ""} ${selectedCustomer.city}`.replace(/ /g, "+")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-primary hover:text-primary/80 transition-colors flex items-center gap-1 text-[12px] font-medium"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Route
                    </a>
                  )}
                </div>
              );
            })()}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Conflict warning */}
      {conflicts.length > 0 && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-warning-muted border border-warning/30 text-[13px]">
          <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-warning">Overlap gedetecteerd!</span>
            <ul className="mt-0.5 text-secondary-foreground">
              {conflicts.map((c) => {
                const t = new Date(c.scheduled_at);
                return (
                  <li key={c.id}>
                    {(c as any).customers?.name ?? "Klant"} — {t.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })} ({c.duration_minutes} min)
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Status</Label>
        <Select value={form.status} onValueChange={(v) => set("status", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {statusOptions.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Notities</Label>
        <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
        <Button type="submit" disabled={loading || !form.customer_id}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit ? "Opslaan" : "Inplannen"}
        </Button>
      </div>
    </form>
  );

  const titleText = isEdit ? "Afspraak bewerken" : isDuplicate ? "Afspraak kopiëren" : "Nieuwe afspraak";

  return (
    <>
      {isMobile ? (
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader className="pb-2">
              <DrawerTitle>{titleText}</DrawerTitle>
            </DrawerHeader>
            <div className="overflow-y-auto flex-1">
              {formContent}
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{titleText}</DialogTitle>
            </DialogHeader>
            {formContent}
          </DialogContent>
        </Dialog>
      )}

      <CustomerDialog
        open={customerDialogOpen}
        onOpenChange={setCustomerDialogOpen}
        onCreated={(newCustomer) => set("customer_id", newCustomer.id)}
      />
      <ServiceDialog
        open={serviceDialogOpen}
        onOpenChange={setServiceDialogOpen}
        onCreated={(newService) => set("service_id", newService.id)}
      />
    </>
  );
};

export default AppointmentDialog;
