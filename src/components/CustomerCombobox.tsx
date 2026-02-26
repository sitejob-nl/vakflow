import { useState, useMemo } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface CustomerOption {
  id: string;
  name: string;
  city?: string | null;
}

interface Props {
  customers: CustomerOption[] | undefined;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const CustomerCombobox = ({ customers, value, onValueChange, placeholder = "Kies klant", className }: Props) => {
  const [open, setOpen] = useState(false);

  const selectedCustomer = useMemo(
    () => customers?.find((c) => c.id === value),
    [customers, value]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="truncate">
            {selectedCustomer ? selectedCustomer.name : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Zoek klant..." />
          <CommandList>
            <CommandEmpty>Geen klant gevonden.</CommandEmpty>
            <CommandGroup>
              {customers?.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.name} ${c.city || ""}`}
                  onSelect={() => {
                    onValueChange(c.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === c.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{c.name}</span>
                  {c.city && (
                    <span className="ml-auto text-xs text-muted-foreground truncate">{c.city}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default CustomerCombobox;
