import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";
import { useGeocode, type GeocodeSuggestion } from "@/hooks/useMapbox";

interface AddressFields {
  street: string;
  house_number: string;
  postal_code: string;
  city: string;
  lat: number | null;
  lng: number | null;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (fields: AddressFields) => void;
  placeholder?: string;
  className?: string;
}

const AddressAutocomplete = ({ value, onChange, onSelect, placeholder = "Zoek adres...", className }: Props) => {
  const { suggestions, loading, search, clear } = useGeocode();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleChange = (val: string) => {
    onChange(val);
    search(val);
    setOpen(true);
  };

  const handleSelect = (s: GeocodeSuggestion) => {
    const display = [s.street, s.house_number].filter(Boolean).join(" ");
    onChange(display);
    onSelect({
      street: s.street,
      house_number: s.house_number,
      postal_code: s.postal_code,
      city: s.city,
      lat: s.lat,
      lng: s.lng,
    });
    clear();
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          className={`pl-8 ${className ?? ""}`}
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-md max-h-[200px] overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              className="w-full text-left px-3 py-2 text-[13px] hover:bg-accent/10 transition-colors border-b border-border/40 last:border-b-0"
              onClick={() => handleSelect(s)}
            >
              <span className="font-medium">{s.street} {s.house_number}</span>
              <span className="text-muted-foreground ml-1">
                {s.postal_code} {s.city}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
