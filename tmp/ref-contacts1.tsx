import { useState } from 'react';
import { Search, Download, User, Building2, Loader2, CheckCircle } from 'lucide-react';
import { useRompslompSettings, useRompslompContacts, useImportRompslompContact } from '@/hooks/useRompslomp';
import { useCustomers } from '@/hooks/useCustomers';
import { toast } from 'sonner';
import type { RompslompContact } from '@/hooks/useRompslomp';

export const RompslompContacts = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: settings } = useRompslompSettings();
  const { data: contacts = [], isLoading } = useRompslompContacts(
    settings?.company_id || null,
    searchQuery || undefined
  );
  const { data: customers = [] } = useCustomers();
  const importContact = useImportRompslompContact();

  // Get list of already imported contact IDs
  const importedContactIds = new Set(
    customers
      .filter(c => c.rompslomp_contact_id)
      .map(c => c.rompslomp_contact_id)
  );

  const handleImport = async (contact: RompslompContact) => {
    try {
      await importContact.mutateAsync({ contact });
      toast.success(`Klant "${contact.name}" succesvol geïmporteerd`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Er ging iets mis bij het importeren';
      toast.error(message);
    }
  };

  if (!settings) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-800">
        Koppel eerst je Rompslomp account in de Instellingen tab.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <h3 className="text-lg font-serif text-admin-dark">Rompslomp Contacten</h3>
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Zoek contacten..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 focus:border-admin-gold focus:outline-none text-sm"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-admin-gold" size={32} />
        </div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {searchQuery ? 'Geen contacten gevonden' : 'Geen contacten in Rompslomp'}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-600">Type</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-600">Naam</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-600">E-mail</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-600">Adres</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-600">Klant #</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-600 text-right">Actie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contacts.map((contact) => {
                const isImported = importedContactIds.has(contact.id);
                const displayName = contact.is_individual 
                  ? (contact.contact_person_name || contact.name)
                  : contact.company_name;
                const addressParts = [contact.address, contact.zipcode, contact.city].filter(Boolean);
                
                return (
                  <tr key={contact.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {contact.is_individual ? (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                          <User size={12} /> Particulier
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded">
                          <Building2 size={12} /> Bedrijf
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-admin-dark">
                      {displayName}
                      {contact.is_individual && contact.company_name && contact.company_name !== contact.contact_person_name && (
                        <span className="block text-xs text-gray-500">{contact.company_name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {contact.contact_person_email_address || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {addressParts.length > 0 ? addressParts.join(', ') : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {contact.contact_number}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isImported ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle size={14} /> Geïmporteerd
                        </span>
                      ) : (
                        <button
                          onClick={() => handleImport(contact)}
                          disabled={importContact.isPending}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-admin-dark border border-admin-dark hover:bg-admin-dark hover:text-white transition-colors disabled:opacity-50"
                        >
                          {importContact.isPending ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Download size={12} />
                          )}
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
};