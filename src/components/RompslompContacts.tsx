import { useState } from "react";
import { Search, Download, User, Building2, Loader2, CheckCircle } from "lucide-react";
import { useRompslompSettings, useRompslompContacts, useImportRompslompContact } from "@/hooks/useRompslomp";
import { useCustomers } from "@/hooks/useCustomers";
import { toast } from "sonner";
import type { RompslompContact } from "@/hooks/useRompslomp";

export function RompslompContacts() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: settings } = useRompslompSettings();
  const hasSettings = !!settings?.company_id;
  const { data: contacts = [], isLoading } = useRompslompContacts(hasSettings, searchQuery || undefined);
  const { data: customers = [] } = useCustomers();
  const importContact = useImportRompslompContact();

  const importedContactIds = new Set(
    customers.filter((c) => c.rompslomp_contact_id).map((c) => c.rompslomp_contact_id)
  );

  const handleImport = async (contact: RompslompContact) => {
    try {
      await importContact.mutateAsync({ contact });
      toast.success(`Klant "${contact.name}" geïmporteerd`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import mislukt");
    }
  };

  if (!hasSettings) {
    return (
      <div className="bg-muted/50 border border-border rounded-lg p-4 text-[13px] text-muted-foreground">
        Koppel eerst je Rompslomp account in de instellingen hierboven.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="text-[14px] font-bold text-foreground">Contacten</h3>
        <div className="flex-1 max-w-sm relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
          <input
            type="text"
            placeholder="Zoek contacten..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-background border border-border rounded-sm text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : contacts.length === 0 ? (
        <p className="text-center py-8 text-[13px] text-muted-foreground">
          {searchQuery ? "Geen contacten gevonden" : "Geen contacten in Rompslomp"}
        </p>
      ) : (
        <div className="border border-border rounded-lg overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Type</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Naam</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">E-mail</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Adres</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Nr.</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Actie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {contacts.map((contact) => {
                const isImported = importedContactIds.has(String(contact.id));
                const displayName = contact.is_individual ? (contact.contact_person_name || contact.name) : contact.company_name;
                const addressParts = [contact.address, contact.zipcode, contact.city].filter(Boolean);

                return (
                  <tr key={contact.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2.5">
                      {contact.is_individual ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-sm">
                          <User size={10} /> Particulier
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-accent-foreground bg-accent/50 px-1.5 py-0.5 rounded-sm">
                          <Building2 size={10} /> Bedrijf
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-[13px] font-medium text-foreground">{displayName}</td>
                    <td className="px-3 py-2.5 text-[12px] text-muted-foreground">{contact.contact_person_email_address || "-"}</td>
                    <td className="px-3 py-2.5 text-[12px] text-muted-foreground">{addressParts.length > 0 ? addressParts.join(", ") : "-"}</td>
                    <td className="px-3 py-2.5 text-[12px] text-muted-foreground">{contact.contact_number}</td>
                    <td className="px-3 py-2.5 text-right">
                      {isImported ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-success">
                          <CheckCircle size={12} /> Geïmporteerd
                        </span>
                      ) : (
                        <button
                          onClick={() => handleImport(contact)}
                          disabled={importContact.isPending}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-primary-foreground bg-primary rounded-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                          {importContact.isPending ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
                          Importeren
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
