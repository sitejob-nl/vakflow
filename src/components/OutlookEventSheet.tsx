import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Calendar, MapPin, Pin, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { useUpsertOutlookOverride, useOutlookOverrides, type OutlookEventOverride } from "@/hooks/useOutlookOverrides";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { useToast } from "@/hooks/use-toast";
import type { OutlookEvent } from "@/hooks/useOutlookCalendar";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: OutlookEvent | null;
}

const OutlookEventSheet = ({ open, onOpenChange, event }: Props) => {
  const { toast } = useToast();
  const { data: overrides } = useOutlookOverrides();
  const upsertOverride = useUpsertOutlookOverride();

  const existing = overrides?.find((o) => o.outlook_event_id === event?.id) ?? null;

  const [pinned, setPinned] = useState(false);
  const [locationLabel, setLocationLabel] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  useEffect(() => {
    if (existing) {
      setPinned(existing.pinned);
      setLocationLabel(existing.location_override || "");
      setLat(existing.lat);
      setLng(existing.lng);
    } else {
      setPinned(false);
      setLocationLabel(event?.location?.displayName || "");
      setLat(null);
      setLng(null);
    }
  }, [existing, event]);

  if (!event) return null;

  const startDate = new Date(event.start.dateTime + (event.start.timeZone === "UTC" ? "Z" : ""));
  const endDate = new Date(event.end.dateTime + (event.end.timeZone === "UTC" ? "Z" : ""));
  const sourceLabel = event._source === "personal" ? "Persoonlijk" : "Bedrijf";

  const handleSave = async () => {
    try {
      await upsertOverride.mutateAsync({
        outlook_event_id: event.id,
        pinned,
        location_override: locationLabel || null,
        lat,
        lng,
      });
      toast({ title: "Opgeslagen" });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#7c3aed]" />
            Outlook Event
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-4">
          {/* Event info */}
          <div className="space-y-2">
            <h3 className="text-[15px] font-bold">{event.subject || "Geen onderwerp"}</h3>
            <p className="text-[13px] text-muted-foreground">
              {format(startDate, "EEEE d MMMM yyyy", { locale: nl })}
            </p>
            <p className="text-[13px] text-muted-foreground">
              {format(startDate, "HH:mm")} – {format(endDate, "HH:mm")}
            </p>
            {event.location?.displayName && (
              <p className="text-[13px] text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {event.location.displayName}
              </p>
            )}
            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${event._source === "personal" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
              {sourceLabel}
            </span>
          </div>

          {event.bodyPreview && (
            <div className="text-[12px] text-secondary-foreground bg-muted rounded-md p-3 max-h-[100px] overflow-y-auto">
              {event.bodyPreview}
            </div>
          )}

          {/* Pin toggle */}
          <div className="flex items-center justify-between border-t border-border pt-4">
            <div className="space-y-0.5">
              <Label className="text-[13px] font-bold flex items-center gap-1.5">
                <Pin className="h-3.5 w-3.5" />
                Kan niet verzet worden
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Route optimalisatie zal deze afspraak niet verplaatsen
              </p>
            </div>
            <Switch checked={pinned} onCheckedChange={setPinned} />
          </div>

          {/* Location override */}
          <div className="space-y-2 border-t border-border pt-4">
            <Label className="text-[13px] font-bold">Locatie (voor route optimalisatie)</Label>
            <p className="text-[11px] text-muted-foreground">
              Voeg een adres toe zodat deze afspraak meegenomen wordt in de routeberekening
            </p>
            <AddressAutocomplete
              value={locationLabel}
              onChange={setLocationLabel}
              onSelect={(fields) => {
                if (fields.lat && fields.lng) {
                  setLat(fields.lat);
                  setLng(fields.lng);
                  setLocationLabel([fields.street, fields.house_number, fields.city].filter(Boolean).join(" "));
                }
              }}
              placeholder="Zoek adres..."
            />
            {lat && lng && (
              <p className="text-[10px] text-muted-foreground">📍 {lat.toFixed(4)}, {lng.toFixed(4)}</p>
            )}
          </div>

          {/* Save button */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
            <Button onClick={handleSave} disabled={upsertOverride.isPending}>
              {upsertOverride.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Opslaan
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default OutlookEventSheet;
