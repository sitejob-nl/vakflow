import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, GripVertical, Loader2, ChevronDown, ChevronRight, FolderOpen } from "lucide-react";
import { SETTINGS_INPUT_CLASS, SETTINGS_LABEL_CLASS } from "@/components/settings/shared";

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "boolean";
  options?: string[];
  required?: boolean;
}

interface ObjectTypeDef {
  key: string;
  label: string;
  fields: FieldDef[];
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
  const [objectTypes, setObjectTypes] = useState<ObjectTypeDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedTypes, setExpandedTypes] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!companyId) return;
    supabase
      .from("companies")
      .select("asset_field_config")
      .eq("id", companyId)
      .single()
      .then(({ data }) => {
        const raw = (data?.asset_field_config ?? []) as unknown as any[];
        // Support legacy flat field arrays by wrapping them
        if (raw.length > 0 && !raw[0].fields) {
          // Legacy: flat FieldDef[] → wrap in a single "Overig" type
          setObjectTypes([{ key: "overig", label: "Overig", fields: raw as FieldDef[] }]);
        } else {
          setObjectTypes(raw as ObjectTypeDef[]);
        }
        setLoading(false);
      });
  }, [companyId]);

  const toggleExpanded = (index: number) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  // ─── Object Type operations ──────────────────────────────

  const addObjectType = () => {
    const newIndex = objectTypes.length;
    setObjectTypes((prev) => [...prev, { key: "", label: "", fields: [] }]);
    setExpandedTypes((prev) => new Set(prev).add(newIndex));
  };

  const updateObjectType = (index: number, updates: Partial<ObjectTypeDef>) => {
    setObjectTypes((prev) =>
      prev.map((ot, i) => {
        if (i !== index) return ot;
        const updated = { ...ot, ...updates };
        if (updates.label !== undefined) {
          updated.key = generateKey(updates.label);
        }
        return updated;
      })
    );
  };

  const removeObjectType = (index: number) => {
    setObjectTypes((prev) => prev.filter((_, i) => i !== index));
    setExpandedTypes((prev) => {
      const next = new Set<number>();
      prev.forEach((v) => {
        if (v < index) next.add(v);
        else if (v > index) next.add(v - 1);
      });
      return next;
    });
  };

  // ─── Field operations ────────────────────────────────────

  const addField = (typeIndex: number) => {
    setObjectTypes((prev) =>
      prev.map((ot, i) =>
        i === typeIndex ? { ...ot, fields: [...ot.fields, { key: "", label: "", type: "text" as const }] } : ot
      )
    );
  };

  const updateField = (typeIndex: number, fieldIndex: number, updates: Partial<FieldDef>) => {
    setObjectTypes((prev) =>
      prev.map((ot, ti) => {
        if (ti !== typeIndex) return ot;
        return {
          ...ot,
          fields: ot.fields.map((f, fi) => {
            if (fi !== fieldIndex) return f;
            const updated = { ...f, ...updates };
            if (updates.label !== undefined) {
              updated.key = generateKey(updates.label);
            }
            if (updates.type && updates.type !== "select") {
              delete updated.options;
            }
            return updated;
          }),
        };
      })
    );
  };

  const removeField = (typeIndex: number, fieldIndex: number) => {
    setObjectTypes((prev) =>
      prev.map((ot, i) =>
        i === typeIndex ? { ...ot, fields: ot.fields.filter((_, fi) => fi !== fieldIndex) } : ot
      )
    );
  };

  // ─── Validation & Save ───────────────────────────────────

  const validate = (): string | null => {
    const typeKeys: string[] = [];
    for (let ti = 0; ti < objectTypes.length; ti++) {
      const ot = objectTypes[ti];
      if (!ot.label.trim()) return `Objecttype ${ti + 1}: naam is verplicht`;
      if (typeKeys.includes(ot.key)) return `Dubbel objecttype: ${ot.label}`;
      typeKeys.push(ot.key);

      const fieldKeys: string[] = [];
      for (let fi = 0; fi < ot.fields.length; fi++) {
        const f = ot.fields[fi];
        if (!f.label.trim()) return `${ot.label} → veld ${fi + 1}: label is verplicht`;
        if (f.type === "select" && (!f.options || f.options.length === 0)) {
          return `${ot.label} → "${f.label}": opties verplicht bij keuzelijst`;
        }
        if (fieldKeys.includes(f.key)) return `${ot.label} → dubbele veldnaam: ${f.label}`;
        fieldKeys.push(f.key);
      }
    }
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) {
      toast({ title: "Validatiefout", description: err, variant: "destructive" });
      return;
    }
    setSaving(true);
    const clean = objectTypes.map((ot) => ({
      key: ot.key,
      label: ot.label.trim(),
      fields: ot.fields.map((f) => {
        const cf: FieldDef = { key: f.key, label: f.label.trim(), type: f.type };
        if (f.type === "select" && f.options) cf.options = f.options;
        if (f.required) cf.required = true;
        return cf;
      }),
    }));
    const { error } = await supabase
      .from("companies")
      .update({ asset_field_config: clean } as any)
      .eq("id", companyId!);
    setSaving(false);
    if (error) {
      toast({ title: "Fout bij opslaan", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Objecttypes opgeslagen" });
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
        <h2 className="text-lg font-bold text-foreground">Objecttypes &amp; velden</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Definieer objecttypes (bv. Dak, CV-ketel) en de bijbehorende extra velden.
        </p>
      </div>

      {objectTypes.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">
          Nog geen objecttypes geconfigureerd.
        </p>
      )}

      <div className="space-y-3">
        {objectTypes.map((ot, ti) => {
          const isExpanded = expandedTypes.has(ti);
          return (
            <div key={ti} className="border border-border rounded-lg overflow-hidden">
              {/* Object type header */}
              <div className="flex items-center gap-2 bg-muted/40 px-3 py-2.5">
                <button
                  type="button"
                  className="shrink-0 p-0.5 hover:bg-muted rounded"
                  onClick={() => toggleExpanded(ti)}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
                <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  className="flex-1 bg-transparent border-none text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none"
                  value={ot.label}
                  onChange={(e) => updateObjectType(ti, { label: e.target.value })}
                  placeholder="Naam objecttype (bv. Dak, CV-ketel)"
                />
                <span className="text-xs text-muted-foreground shrink-0">
                  {ot.fields.length} veld{ot.fields.length !== 1 ? "en" : ""}
                </span>
                <Button size="icon" variant="ghost" className="shrink-0 h-7 w-7" onClick={() => removeObjectType(ti)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>

              {/* Fields (collapsible) */}
              {isExpanded && (
                <div className="p-3 space-y-2.5">
                  {ot.key && (
                    <div className="text-xs text-muted-foreground mb-1">
                      Key: <code className="bg-muted px-1 rounded">{ot.key}</code>
                    </div>
                  )}

                  {ot.fields.length === 0 && (
                    <p className="text-xs text-muted-foreground py-2">Nog geen velden. Voeg er een toe.</p>
                  )}

                  {ot.fields.map((field, fi) => (
                    <div key={fi} className="flex items-start gap-2 bg-background border border-border rounded-md p-2.5">
                      <GripVertical className="w-4 h-4 mt-2.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={SETTINGS_LABEL_CLASS}>Label</label>
                            <input
                              className={SETTINGS_INPUT_CLASS}
                              value={field.label}
                              onChange={(e) => updateField(ti, fi, { label: e.target.value })}
                              placeholder="bv. Daktype"
                            />
                          </div>
                          <div>
                            <label className={SETTINGS_LABEL_CLASS}>Type</label>
                            <Select value={field.type} onValueChange={(v) => updateField(ti, fi, { type: v as FieldDef["type"] })}>
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
                                updateField(ti, fi, {
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
                      </div>
                      <Button size="icon" variant="ghost" className="shrink-0 mt-1 h-7 w-7" onClick={() => removeField(ti, fi)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}

                  <Button variant="outline" size="sm" onClick={() => addField(ti)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Veld toevoegen
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" size="sm" onClick={addObjectType}>
          <Plus className="w-4 h-4 mr-1" /> Objecttype toevoegen
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? "Opslaan..." : "Opslaan"}
        </Button>
      </div>
    </div>
  );
};

export default SettingsAssetFieldsTab;
