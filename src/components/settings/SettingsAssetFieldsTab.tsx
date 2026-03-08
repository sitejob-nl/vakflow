import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, GripVertical, Loader2 } from "lucide-react";
import { SETTINGS_INPUT_CLASS, SETTINGS_LABEL_CLASS } from "@/components/settings/shared";

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "boolean";
  options?: string[];
  required?: boolean;
}

const FIELD_TYPES = [
  { value: "text", label: "Tekst" },
  { value: "number", label: "Getal" },
  { value: "date", label: "Datum" },
  { value: "select", label: "Keuzelijst" },
  { value: "boolean", label: "Ja/Nee" },
];

const generateKey = (label: string) =>
  label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").replace(/_+/g, "_");

const SettingsAssetFieldsTab = () => {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    supabase
      .from("companies")
      .select("asset_field_config")
      .eq("id", companyId)
      .single()
      .then(({ data }) => {
        setFields((data?.asset_field_config as FieldDef[] | null) ?? []);
        setLoading(false);
      });
  }, [companyId]);

  const addField = () => {
    setFields((prev) => [...prev, { key: "", label: "", type: "text" }]);
  };

  const updateField = (index: number, updates: Partial<FieldDef>) => {
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== index) return f;
        const updated = { ...f, ...updates };
        if (updates.label !== undefined) {
          updated.key = generateKey(updates.label);
        }
        if (updates.type && updates.type !== "select") {
          delete updated.options;
        }
        return updated;
      })
    );
  };

  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = (): string | null => {
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      if (!f.label.trim()) return `Veld ${i + 1}: label is verplicht`;
      if (f.type === "select" && (!f.options || f.options.length === 0)) {
        return `Veld "${f.label}": opties zijn verplicht bij keuzelijst`;
      }
    }
    const keys = fields.map((f) => f.key);
    const dupes = keys.filter((k, i) => k && keys.indexOf(k) !== i);
    if (dupes.length > 0) return `Dubbele veldnaam: ${dupes[0]}`;
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) {
      toast({ title: "Validatiefout", description: err, variant: "destructive" });
      return;
    }
    setSaving(true);
    const cleanFields = fields.map((f) => {
      const clean: FieldDef = { key: f.key, label: f.label.trim(), type: f.type };
      if (f.type === "select" && f.options) clean.options = f.options;
      if (f.required) clean.required = true;
      return clean;
    });
    const { error } = await supabase
      .from("companies")
      .update({ asset_field_config: cleanFields } as any)
      .eq("id", companyId!);
    setSaving(false);
    if (error) {
      toast({ title: "Fout bij opslaan", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Objectvelden opgeslagen" });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-foreground">Objectvelden</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Definieer extra velden die bij elk object ingevuld kunnen worden.
        </p>
      </div>

      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">
          Nog geen custom velden geconfigureerd.
        </p>
      )}

      <div className="space-y-3">
        {fields.map((field, i) => (
          <div key={i} className="flex items-start gap-2 bg-muted/40 rounded-md p-3">
            <GripVertical className="w-4 h-4 mt-2.5 text-muted-foreground shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={SETTINGS_LABEL_CLASS}>Label</label>
                  <input
                    className={SETTINGS_INPUT_CLASS}
                    value={field.label}
                    onChange={(e) => updateField(i, { label: e.target.value })}
                    placeholder="bv. Daktype"
                  />
                </div>
                <div>
                  <label className={SETTINGS_LABEL_CLASS}>Type</label>
                  <Select value={field.type} onValueChange={(v) => updateField(i, { type: v as FieldDef["type"] })}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {field.type === "select" && (
                <div>
                  <label className={SETTINGS_LABEL_CLASS}>Opties (komma-gescheiden)</label>
                  <input
                    className={SETTINGS_INPUT_CLASS}
                    value={(field.options ?? []).join(", ")}
                    onChange={(e) =>
                      updateField(i, {
                        options: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="bv. Bitumen, Pannen, EPDM"
                  />
                </div>
              )}
              {field.key && (
                <div className="text-xs text-muted-foreground">
                  Key: <code className="bg-muted px-1 rounded">{field.key}</code>
                </div>
              )}
            </div>
            <Button size="icon" variant="ghost" className="shrink-0 mt-1" onClick={() => removeField(i)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" size="sm" onClick={addField}>
          <Plus className="w-4 h-4 mr-1" /> Veld toevoegen
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? "Opslaan..." : "Opslaan"}
        </Button>
      </div>
    </div>
  );
};

export default SettingsAssetFieldsTab;
