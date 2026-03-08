import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Trash2, Copy, Key, Eye, EyeOff } from "lucide-react";

const SettingsApiKeysTab = () => {
  const { companyId } = useAuth();
  const qc = useQueryClient();
  const [newKeyName, setNewKeyName] = useState("API Key");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ["api_keys", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_keys" as any)
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const createKey = useMutation({
    mutationFn: async () => {
      const rawKey = `vk_${crypto.randomUUID().replace(/-/g, "")}`;
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(rawKey));
      const keyHash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const { error } = await supabase.from("api_keys" as any).insert({
        company_id: companyId,
        key_hash: keyHash,
        key_prefix: rawKey.substring(0, 11),
        name: newKeyName.trim() || "API Key",
      } as any);
      if (error) throw error;
      return rawKey;
    },
    onSuccess: (key) => {
      setCreatedKey(key);
      setShowKey(true);
      setNewKeyName("API Key");
      qc.invalidateQueries({ queryKey: ["api_keys"] });
      toast.success("API key aangemaakt");
    },
    onError: () => toast.error("Fout bij aanmaken"),
  });

  const deleteKey = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("api_keys" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api_keys"] });
      toast.success("API key verwijderd");
    },
  });

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const baseUrl = `https://${projectId}.supabase.co/functions/v1/leads-api`;

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6 space-y-4">
        <h3 className="text-[14px] font-bold flex items-center gap-2">
          <Key className="h-4 w-4" /> API Keys
        </h3>
        <p className="text-[12px] text-muted-foreground">
          Beheer API keys voor externe toegang tot de Leads API.
        </p>

        {/* Create new key */}
        <div className="flex gap-2">
          <Input
            placeholder="Naam voor de key"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            className="max-w-[240px] text-[13px]"
          />
          <Button
            size="sm"
            onClick={() => createKey.mutate()}
            disabled={createKey.isPending}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Aanmaken
          </Button>
        </div>

        {/* Show created key (once) */}
        {createdKey && (
          <div className="bg-muted border border-border rounded-md p-3 space-y-2">
            <p className="text-[12px] font-bold text-destructive">
              ⚠️ Kopieer deze key nu — hij wordt niet meer getoond!
            </p>
            <div className="flex items-center gap-2">
              <code className="text-[12px] bg-background border border-border rounded px-2 py-1 flex-1 break-all">
                {showKey ? createdKey : "••••••••••••••••••••••••"}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  navigator.clipboard.writeText(createdKey);
                  toast.success("Gekopieerd!");
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-[11px]"
              onClick={() => { setCreatedKey(null); setShowKey(false); }}
            >
              Sluiten
            </Button>
          </div>
        )}

        {/* Existing keys */}
        <div className="space-y-2">
          {isLoading && <p className="text-[12px] text-muted-foreground">Laden...</p>}
          {keys.map((k: any) => (
            <div
              key={k.id}
              className="flex items-center justify-between p-3 border border-border rounded-sm bg-background"
            >
              <div>
                <p className="text-[13px] font-bold">{k.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  <code>{k.key_prefix}•••</code>
                  {k.last_used_at && (
                    <> · Laatst gebruikt: {new Date(k.last_used_at).toLocaleDateString("nl-NL")}</>
                  )}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => deleteKey.mutate(k.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {!isLoading && keys.length === 0 && (
            <p className="text-[12px] text-muted-foreground">Nog geen API keys aangemaakt.</p>
          )}
        </div>
      </div>

      {/* Documentation */}
      <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6 space-y-3">
        <h3 className="text-[14px] font-bold">API Documentatie</h3>
        <p className="text-[12px] text-muted-foreground">
          Gebruik de Leads API om leads vanuit externe systemen aan te maken of op te halen.
        </p>

        <div className="space-y-3">
          <div>
            <p className="text-[12px] font-bold mb-1">Lead aanmaken (POST)</p>
            <pre className="bg-muted text-[11px] p-3 rounded-md overflow-x-auto whitespace-pre-wrap break-all">
{`curl -X POST "${baseUrl}" \\
  -H "X-API-Key: vk_jouw_key_hier" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Jan de Vries","email":"jan@voorbeeld.nl","phone":"0612345678","source":"website"}'`}
            </pre>
          </div>

          <div>
            <p className="text-[12px] font-bold mb-1">Leads ophalen (GET)</p>
            <pre className="bg-muted text-[11px] p-3 rounded-md overflow-x-auto whitespace-pre-wrap break-all">
{`curl "${baseUrl}?limit=20&offset=0" \\
  -H "X-API-Key: vk_jouw_key_hier"`}
            </pre>
          </div>

          <div>
            <p className="text-[12px] font-bold mb-1">Lead bijwerken (PATCH)</p>
            <pre className="bg-muted text-[11px] p-3 rounded-md overflow-x-auto whitespace-pre-wrap break-all">
{`curl -X PATCH "${baseUrl}?id=LEAD_ID" \\
  -H "X-API-Key: vk_jouw_key_hier" \\
  -H "Content-Type: application/json" \\
  -d '{"status":"Gecontacteerd"}'`}
            </pre>
          </div>

          <div>
            <p className="text-[12px] font-bold mb-1">Lead verwijderen (DELETE)</p>
            <pre className="bg-muted text-[11px] p-3 rounded-md overflow-x-auto whitespace-pre-wrap break-all">
{`curl -X DELETE "${baseUrl}?id=LEAD_ID" \\
  -H "X-API-Key: vk_jouw_key_hier"`}
            </pre>
          </div>
        </div>

        <div className="border-t border-border pt-3">
          <p className="text-[12px] font-bold mb-1">Beschikbare velden</p>
          <div className="text-[11px] text-muted-foreground space-y-0.5">
            <p><code>name</code> (verplicht) — Naam van de lead</p>
            <p><code>email</code> — E-mailadres</p>
            <p><code>phone</code> — Telefoonnummer</p>
            <p><code>company_name</code> — Bedrijfsnaam</p>
            <p><code>notes</code> — Notities</p>
            <p><code>source</code> — Bron (bijv. "website", "formulier")</p>
            <p><code>value</code> — Waarde (nummer)</p>
            <p><code>status</code> — Statusnaam (bijv. "Nieuw")</p>
            <p><code>custom_fields</code> — Object met eigen velden</p>
          </div>
        </div>

        <div className="border-t border-border pt-3">
          <p className="text-[12px] font-bold mb-1">Rate limiting</p>
          <p className="text-[11px] text-muted-foreground">Max 60 verzoeken per minuut per bedrijf.</p>
        </div>
      </div>
    </div>
  );
};

export default SettingsApiKeysTab;
