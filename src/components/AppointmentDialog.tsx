import { useState, useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CustomerCombobox from "@/components/CustomerCombobox";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Navigation, MapPin, ExternalLink, Plus, AlertTriangle, Car } from "lucide-react";
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

const AppointmentDialog = ({ open, onOpenChange, appointment, defaultDate }: Props) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { industry } = useIndustryConfig();
  const isAutomotive = industry === "automotive";
  const { data: customers } = useCustomers();
  const { data: services } = useServices();
  const createAppointment = useCreateAppointment();
  const updateAppointment = useUpdateAppointment();
  const { result: travelInfo, loading: travelLoading, calculate: calcTravel } = useDirections();
  const isDuplicate = appointment?.id === "__duplicate__";
  const isEdit = !!appointment && !isDuplicate;

  // Fetch company start location from profile
  const defaultStartRef = useRef<{ coords: [number, number]; label: string }>({
    coords: FALLBACK_START,
    label: FALLBACK_START_LABEL,
  });
  const [defaultStartLoaded, setDefaultStartLoaded] = useState(false);

  useEffect(() => {
    if (!user?.id || defaultStartLoaded) return;
    let cancelled = false;
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("location")
        .eq("id", user.id)
        .maybeSingle();
      const loc = profile?.location;
      if (!loc || cancelled) { setDefaultStartLoaded(true); return; }

      // Geocode the location string to get coordinates
      const { data } = await supabase.functions.invoke("google-maps-proxy", {
        body: { action: "geocode", query: loc },
      });
      if (cancelled) return;
      const first = data?.[0];
      if (first?.lat && first?.lng) {
        defaultStartRef.current = {
          coords: [first.lat, first.lng],
          label: loc,
        };
      }
      setDefaultStartLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [user?.id, defaultStartLoaded]);

  const DEFAULT_START = defaultStartRef.current.coords;
  const DEFAULT_START_LABEL = defaultStartRef.current.label;

  // Determine the assigned_to for filtering: use existing appointment's value or current user
  const assignedTo = appointment?.assigned_to || user?.id || null;
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const isMobile = useIsMobile();

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
  });

  // Fetch vehicles for the selected customer (automotive only)
  const { data: customerVehicles } = useCustomerVehicles(isAutomotive && form.customer_id ? form.customer_id : undefined);

  // Fetch addresses for the selected customer
  const { data: customerAddresses } = useAddresses(form.customer_id || undefined);

  const [startLocationLabel, setStartLocationLabel] = useState(DEFAULT_START_LABEL);
  const [startCoords, setStartCoords] = useState<[number, number]>(DEFAULT_START);

  // Parse date from form for day-query
  const formDate = useMemo(() => {
    if (!form.scheduled_at) return null;
    const d = new Date(form.scheduled_at);
    return isNaN(d.getTime()) ? null : d;
  }, [form.scheduled_at]);

  const { data: dayAppointments } = useAppointmentsForDay(formDate, assignedTo);

  // Find previous appointment on same day (before current time)
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

  // Conflict detection: find overlapping appointments
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
        scheduled_at: scheduledAt,
        duration_minutes: appointment.duration_minutes ?? 60,
        status: isDuplicate ? "gepland" : appointment.status,
        notes: appointment.notes || "",
      });
      setStartLocationLabel((appointment as any).start_location_label || DEFAULT_START_LABEL);
    } else {
      const dt = defaultDate ?? new Date();
      setForm({
        customer_id: "",
        service_id: "",
        address_id: "",
        scheduled_at: formatDateTimeLocal(dt),
        duration_minutes: 60,
        status: "gepland",
        notes: "",
      });
      setStartLocationLabel(DEFAULT_START_LABEL);
      setStartCoords(DEFAULT_START);
    }
  }, [appointment, open, defaultDate]);

  // Auto-fill previous appointment location as start point
  useEffect(() => {
    if (!previousAppointment) return;
    const c = previousAppointment.customers as any;
    if (c?.lat && c?.lng) {
      setStartCoords([c.lat, c.lng]);
      setStartLocationLabel(`${c.name} — ${c.city || ""}`.trim());
    }
  }, [previousAppointment?.id]);

  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  // Auto-fill duration when service is selected
  useEffect(() => {
    if (!form.service_id || !services) return;
    const selected = services.find((s) => s.id === form.service_id);
    if (selected && (selected as any).duration_minutes) {
      setForm((f) => ({ ...f, duration_minutes: (selected as any).duration_minutes }));
    }
  }, [form.service_id, services]);

  // Calculate travel time when customer or start location changes
  useEffect(() => {
    if (!form.customer_id || !customers) return;
    const c = customers.find((c) => c.id === form.customer_id);
    const lat = (c as any)?.lat;
    const lng = (c as any)?.lng;
    if (lat && lng && startCoords[0] && startCoords[1]) {
      calcTravel(startCoords, [lat, lng]);
    }
  }, [form.customer_id, customers, startCoords]);

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
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      duration_minutes: form.duration_minutes,
      status: form.status,
      notes: form.notes || null,
      travel_time_minutes: travelInfo?.duration_minutes ?? null,
      start_location_label: startLocationLabel || null,
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

        // Trigger WhatsApp automation
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

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-6">
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

      {/* Start location */}
      <div className="space-y-1.5">
        <Label>Startlocatie</Label>
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
