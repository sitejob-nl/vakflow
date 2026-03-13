import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Building2 } from "lucide-react";
import { useCreateCustomer, useServices } from "@/hooks/useCustomers";
import { useToast } from "@/hooks/use-toast";
import { useNavigation } from "@/hooks/useNavigation";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import KvkSearchInput from "@/components/KvkSearchInput";
import type { KvkCompanyData } from "@/hooks/useKvkLookup";

const CustomerCreatePage = () => {
  const { toast } = useToast();
  const { navigate } = useNavigation();
  const { companyId } = useAuth();
  const { data: services } = useServices();
  const createCustomer = useCreateCustomer();
  const [accountingProvider, setAccountingProvider] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    (supabase.from("companies_safe" as any).select("accounting_provider").eq("id", companyId).single() as unknown as Promise<{ data: any }>).then(({ data }) => {
      setAccountingProvider(data?.accounting_provider ?? null);
    });
  }, [companyId]);

  const [form, setForm] = useState({
    name: "",
    type: "particulier",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
    postal_code: "",
    city: "",
    lat: null as number | null,
    lng: null as number | null,
    default_service_id: "",
    interval_months: 24,
    whatsapp_optin: false,
    notes: "",
    kvk_number: "",
    btw_number: "",
  });

  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  const handleKvkSelected = (data: KvkCompanyData) => {
    const addr = data.visit_address || data.postal_address;
    setForm((f) => ({
      ...f,
      name: data.company_name || f.name,
      address: addr ? [addr.street, addr.house_number].filter(Boolean).join(" ") : f.address,
      postal_code: addr?.postal_code || f.postal_code,
      city: addr?.city || f.city,
      kvk_number: data.kvk_number || f.kvk_number,
      lat: data.latitude ?? f.lat,
      lng: data.longitude ?? f.lng,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      default_service_id: form.default_service_id || null,
    };

    // Auto-geocode if address is filled but coordinates are missing
    if (payload.lat == null && payload.lng == null && payload.address && payload.city) {
      try {
        const query = [payload.address, payload.postal_code, payload.city].filter(Boolean).join(", ");
        const { data, error } = await supabase.functions.invoke("google-maps-proxy", {
          body: { action: "geocode", query },
        });
        if (!error && data?.[0]) {
          payload.lat = data[0].lat;
          payload.lng = data[0].lng;
        }
      } catch {
        // Continue saving without coordinates
      }
    }

    try {
      const newCustomer = await createCustomer.mutateAsync(payload);
      toast({ title: "Klant aangemaakt" });
      // Auto-sync to WeFact if connected
      if (accountingProvider === "wefact") {
        supabase.functions.invoke("sync-wefact", {
          body: { action: "sync-customer", customer_id: newCustomer.id },
        }).catch(() => {}); // fire-and-forget
      }
      if (accountingProvider === "moneybird") {
        supabase.functions.invoke("sync-moneybird", {
          body: { action: "sync-customer", customer_id: newCustomer.id },
        }).catch(() => {}); // fire-and-forget
      }
      if (accountingProvider === "eboekhouden") {
        supabase.functions.invoke("sync-invoice-eboekhouden", {
          body: { action: "sync-customer", customer_id: newCustomer.id },
        }).catch(() => {}); // fire-and-forget
      }
      if (accountingProvider === "rompslomp") {
        supabase.functions.invoke("sync-rompslomp", {
          body: { action: "sync-customer", customer_id: newCustomer.id },
        }).catch(() => {}); // fire-and-forget
      }
      navigate("custDetail", { customerId: newCustomer.id });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const loading = createCustomer.isPending;

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate("customers")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Terug naar klanten
      </button>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Nieuwe klant</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Type selectie */}
            <div className="space-y-1.5">
              <Label>Type klant</Label>
              <Select value={form.type} onValueChange={(v) => set("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="particulier">Particulier</SelectItem>
                  <SelectItem value="zakelijk">Zakelijk</SelectItem>
                  <SelectItem value="vve">VvE</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* KVK lookup - alleen bij zakelijk */}
            {form.type === "zakelijk" && (
              <div className="space-y-1.5 p-4 rounded-lg border border-border bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-semibold">KVK Zoeken</Label>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Zoek op KVK-nummer of bedrijfsnaam om gegevens automatisch in te vullen.
                </p>
                <KvkSearchInput
                  onCompanySelected={handleKvkSelected}
                  initialValue={form.kvk_number}
                />
              </div>
            )}

            {/* Bedrijfsgegevens */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Naam *</Label>
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} required placeholder={form.type === "zakelijk" ? "Bedrijfsnaam B.V." : "Fam. De Vries"} />
              </div>

              {form.type === "zakelijk" && (
                <>
                  <div className="space-y-1.5">
                    <Label>KVK-nummer</Label>
                    <Input value={form.kvk_number} onChange={(e) => set("kvk_number", e.target.value)} placeholder="12345678" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>BTW-nummer</Label>
                    <Input value={form.btw_number} onChange={(e) => set("btw_number", e.target.value)} placeholder="NL123456789B01" />
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <Label>Contactpersoon</Label>
                <Input value={form.contact_person} onChange={(e) => set("contact_person", e.target.value)} placeholder="Jan de Vries" />
              </div>
              <div className="space-y-1.5">
                <Label>Telefoon</Label>
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="06-1234 5678" />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label>E-mail</Label>
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="jan@devries.nl" />
              </div>
            </div>

            {/* Adres */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Adresgegevens</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label>Adres</Label>
                  <AddressAutocomplete
                    value={form.address}
                    onChange={(v) => set("address", v)}
                    onSelect={(fields) => {
                      setForm((f) => ({
                        ...f,
                        address: [fields.street, fields.house_number].filter(Boolean).join(" "),
                        postal_code: fields.postal_code,
                        city: fields.city,
                        lat: fields.lat,
                        lng: fields.lng,
                      }));
                    }}
                    placeholder="Zoek adres..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Postcode</Label>
                  <Input value={form.postal_code} onChange={(e) => set("postal_code", e.target.value)} placeholder="1961 AB" />
                </div>
                <div className="space-y-1.5">
                  <Label>Plaats</Label>
                  <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Heemskerk" />
                </div>
              </div>
            </div>

            {/* Dienst & interval */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Service-instellingen</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Standaard dienst</Label>
                  <Select value={form.default_service_id} onValueChange={(v) => set("default_service_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Kies dienst" /></SelectTrigger>
                    <SelectContent>
                      {services?.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name} — €{s.price}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Interval (maanden)</Label>
                  <Input type="number" value={form.interval_months} onChange={(e) => set("interval_months", parseInt(e.target.value) || 24)} />
                </div>
              </div>
            </div>

            {/* Extra */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Switch checked={form.whatsapp_optin} onCheckedChange={(v) => set("whatsapp_optin", v)} />
                <Label>WhatsApp opt-in</Label>
              </div>
              <div className="space-y-1.5">
                <Label>Opmerkingen</Label>
                <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} />
              </div>
            </div>

            {/* Acties */}
            <div className="flex justify-end gap-3 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={() => navigate("customers")}>
                Annuleren
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Klant toevoegen
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerCreatePage;
