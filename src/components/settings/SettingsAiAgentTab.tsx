import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { Loader2, X, Plus, GripVertical, Bot, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SETTINGS_INPUT_CLASS as inputClass, SETTINGS_LABEL_CLASS as labelClass } from "./shared";

const SUPABASE_URL = "https://sigzpqwnavfxtvbyqvzj.supabase.co";

const DAYS = [
  { key: "ma", label: "Maandag" },
  { key: "di", label: "Dinsdag" },
  { key: "wo", label: "Woensdag" },
  { key: "do", label: "Donderdag" },
  { key: "vr", label: "Vrijdag" },
  { key: "za", label: "Zaterdag" },
  { key: "zo", label: "Zondag" },
];

const DEFAULT_QUESTIONS = [
  "Wat is het kenteken?",
  "Wat is de klacht of het probleem?",
  "Hoe urgent is het?",
  "Wat is uw naam?",
  "Wanneer heeft u voorkeur voor een afspraak?",
];

interface RoutingRule {
  keywords: string[];
  department: string;
  priority: string;
}

interface DayHours {
  open: boolean;
  from: string;
  to: string;
}

interface AgentForm {
  id?: string;
  enabled: boolean;
  language: string;
  greeting_text: string;
  intake_questions: string[];
  routing_rules: RoutingRule[];
  business_hours: Record<string, DayHours>;
  outside_hours: boolean;
  escalation_action: string;
  escalation_users: string[];
  max_turns: number;
  voice_id: string;
}

const defaultHours = (): Record<string, DayHours> => {
  const h: Record<string, DayHours> = {};
  DAYS.forEach(d => {
    h[d.key] = ["za", "zo"].includes(d.key)
      ? { open: false, from: "09:00", to: "17:00" }
      : { open: true, from: "08:00", to: "17:30" };
  });
  return h;
};

const DEFAULT: AgentForm = {
  enabled: false,
  language: "nl",
  greeting_text: "",
  intake_questions: [...DEFAULT_QUESTIONS],
  routing_rules: [
    { keywords: ["APK", "onderhoud", "reparatie", "storing"], department: "werkplaats", priority: "normaal" },
    { keywords: ["kopen", "interesse", "proefrit", "inruil"], department: "verkoop", priority: "normaal" },
  ],
  business_hours: defaultHours(),
  outside_hours: false,
  escalation_action: "notify",
  escalation_users: [],
  max_turns: 10,
  voice_id: "",
};

const SettingsAiAgentTab = () => {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const { data: teamMembers } = useTeamMembers();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AgentForm>(DEFAULT);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const { data } = await supabase
        .from("ai_agent_config" as any)
        .select("*")
        .eq("company_id", companyId)
        .single() as { data: any };
      if (data) {
        const bh = (data.business_hours as Record<string, DayHours>) || defaultHours();
        setForm({
          id: data.id,
          enabled: data.enabled ?? false,
          language: data.language || "nl",
          greeting_text: data.greeting_text || "",
          intake_questions: (data.intake_questions as string[]) || [...DEFAULT_QUESTIONS],
          routing_rules: (data.routing_rules as RoutingRule[]) || DEFAULT.routing_rules,
          business_hours: { ...defaultHours(), ...bh },
          outside_hours: (bh as any)?._outside_hours ?? false,
          escalation_action: data.escalation_action || "notify",
          escalation_users: data.escalation_users || [],
          max_turns: data.max_turns ?? 10,
          voice_id: data.voice_id || "",
        });
      }
      setLoading(false);
    })();
  }, [companyId]);

  const handleSave = async () => {
    if (!companyId) return;
    setSaving(true);
    const bhWithMeta = { ...form.business_hours, _outside_hours: form.outside_hours };
    const payload: any = {
      company_id: companyId,
      enabled: form.enabled,
      language: form.language,
      greeting_text: form.greeting_text || null,
      intake_questions: form.intake_questions,
      routing_rules: form.routing_rules,
      business_hours: bhWithMeta,
      escalation_action: form.escalation_action,
      escalation_users: form.escalation_users,
      max_turns: form.max_turns,
      voice_id: form.voice_id || null,
      updated_at: new Date().toISOString(),
    };

    let error: any;
    if (form.id) {
      ({ error } = await supabase.from("ai_agent_config" as any).update(payload).eq("id", form.id));
    } else {
      const { data, error: insertError } = await supabase
        .from("ai_agent_config" as any)
        .insert(payload)
        .select("id")
        .single() as { data: any; error: any };
      error = insertError;
      if (data) setForm(prev => ({ ...prev, id: data.id }));
    }

    setSaving(false);
    toast(error
      ? { title: "Fout", description: error.message, variant: "destructive" }
      : { title: "AI Agent instellingen opgeslagen" });
  };

  // Intake questions helpers
  const addQuestion = () => setForm(prev => ({ ...prev, intake_questions: [...prev.intake_questions, ""] }));
  const removeQuestion = (idx: number) => setForm(prev => ({
    ...prev, intake_questions: prev.intake_questions.filter((_, i) => i !== idx),
  }));
  const updateQuestion = (idx: number, val: string) => setForm(prev => ({
    ...prev, intake_questions: prev.intake_questions.map((q, i) => i === idx ? val : q),
  }));
  const moveQuestion = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= form.intake_questions.length) return;
    setForm(prev => {
      const arr = [...prev.intake_questions];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return { ...prev, intake_questions: arr };
    });
  };

  // Routing rules helpers
  const addRule = () => setForm(prev => ({
    ...prev, routing_rules: [...prev.routing_rules, { keywords: [], department: "werkplaats", priority: "normaal" }],
  }));
  const removeRule = (idx: number) => setForm(prev => ({
    ...prev, routing_rules: prev.routing_rules.filter((_, i) => i !== idx),
  }));
  const updateRule = (idx: number, patch: Partial<RoutingRule>) => setForm(prev => ({
    ...prev, routing_rules: prev.routing_rules.map((r, i) => i === idx ? { ...r, ...patch } : r),
  }));

  // Business hours
  const updateDay = (key: string, patch: Partial<DayHours>) => setForm(prev => ({
    ...prev, business_hours: { ...prev.business_hours, [key]: { ...prev.business_hours[key], ...patch } },
  }));

  // Escalation users toggle
  const toggleUser = (userId: string) => setForm(prev => ({
    ...prev,
    escalation_users: prev.escalation_users.includes(userId)
      ? prev.escalation_users.filter(u => u !== userId)
      : [...prev.escalation_users, userId],
  }));

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6 space-y-6">
      {/* Algemeen */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${form.enabled ? "bg-emerald-500/15" : "bg-muted"}`}>
              <Bot className={`h-5 w-5 ${form.enabled ? "text-emerald-600" : "text-muted-foreground"}`} />
            </div>
            <div>
              <h3 className="text-[14px] font-bold">AI Agent</h3>
              <p className="text-[11px] text-muted-foreground">{form.enabled ? "Actief — beantwoordt gesprekken automatisch" : "Inactief"}</p>
            </div>
          </div>
          <Switch checked={form.enabled} onCheckedChange={v => setForm(prev => ({ ...prev, enabled: v }))} />
        </div>

        <div className="space-y-3">
          <div>
            <label className={labelClass}>Taal</label>
            <Select value={form.language} onValueChange={v => setForm(prev => ({ ...prev, language: v }))}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nl">Nederlands</SelectItem>
                <SelectItem value="en">Engels</SelectItem>
                <SelectItem value="de">Duits</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className={labelClass}>Begroetingstekst</label>
            <Textarea
              value={form.greeting_text}
              onChange={e => setForm(prev => ({ ...prev, greeting_text: e.target.value }))}
              placeholder="Goedemiddag, [bedrijfsnaam]. Ik help u graag verder."
              rows={2}
            />
          </div>
        </div>
      </div>

      {/* Intake vragen */}
      <div className="border-t border-border pt-5">
        <h3 className="text-[14px] font-bold mb-3">Intake vragen</h3>
        <div className="space-y-2">
          {form.intake_questions.map((q, i) => (
            <div key={i} className="flex items-center gap-2">
              <button
                type="button"
                className="cursor-grab text-muted-foreground hover:text-foreground flex flex-col"
                onClick={() => moveQuestion(i, -1)}
                title="Omhoog"
              >
                <GripVertical className="h-4 w-4" />
              </button>
              <input
                value={q}
                onChange={e => updateQuestion(i, e.target.value)}
                className={`${inputClass} flex-1`}
                placeholder="Stel een vraag..."
              />
              <button onClick={() => removeQuestion(i)} className="text-muted-foreground hover:text-destructive">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={addQuestion} className="mt-2 gap-1">
          <Plus className="h-3.5 w-3.5" /> Vraag toevoegen
        </Button>
      </div>

      {/* Routing */}
      <div className="border-t border-border pt-5">
        <h3 className="text-[14px] font-bold mb-3">Routing</h3>
        <div className="space-y-3">
          {form.routing_rules.map((rule, i) => (
            <RoutingRuleRow key={i} rule={rule} onChange={patch => updateRule(i, patch)} onRemove={() => removeRule(i)} />
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={addRule} className="mt-2 gap-1">
          <Plus className="h-3.5 w-3.5" /> Regel toevoegen
        </Button>
      </div>

      {/* Openingstijden */}
      <div className="border-t border-border pt-5">
        <h3 className="text-[14px] font-bold mb-3">Openingstijden</h3>
        <div className="space-y-2">
          {DAYS.map(d => {
            const day = form.business_hours[d.key] || { open: false, from: "09:00", to: "17:00" };
            return (
              <div key={d.key} className="flex items-center gap-3 text-sm">
                <div className="w-[80px] font-medium text-[13px]">{d.label}</div>
                <Switch checked={day.open} onCheckedChange={v => updateDay(d.key, { open: v })} />
                {day.open ? (
                  <>
                    <input
                      type="time"
                      value={day.from}
                      onChange={e => updateDay(d.key, { from: e.target.value })}
                      className={`${inputClass} w-[110px] text-xs`}
                    />
                    <span className="text-muted-foreground text-xs">—</span>
                    <input
                      type="time"
                      value={day.to}
                      onChange={e => updateDay(d.key, { to: e.target.value })}
                      className={`${inputClass} w-[110px] text-xs`}
                    />
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">Gesloten</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-3">
          <div>
            <p className="text-[13px] font-medium">AI mag ook buiten openingstijden antwoorden</p>
          </div>
          <Switch checked={form.outside_hours} onCheckedChange={v => setForm(prev => ({ ...prev, outside_hours: v }))} />
        </div>
      </div>

      {/* Escalatie */}
      <div className="border-t border-border pt-5">
        <h3 className="text-[14px] font-bold mb-3">Escalatie</h3>
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Actie bij escalatie</label>
            <Select value={form.escalation_action} onValueChange={v => setForm(prev => ({ ...prev, escalation_action: v }))}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="notify">Stuur notificatie</SelectItem>
                <SelectItem value="transfer">Verbind door</SelectItem>
                <SelectItem value="voicemail">Voicemail</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className={labelClass}>Escalatie-gebruikers</label>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              {(teamMembers || []).map((m: any) => (
                <label key={m.id} className="flex items-center gap-2 text-[13px] cursor-pointer p-1.5 rounded hover:bg-muted/50">
                  <Checkbox
                    checked={form.escalation_users.includes(m.id)}
                    onCheckedChange={() => toggleUser(m.id)}
                  />
                  <span>{m.full_name || m.email}</span>
                </label>
              ))}
              {(!teamMembers || teamMembers.length === 0) && (
                <p className="text-xs text-muted-foreground col-span-2">Geen teamleden gevonden</p>
              )}
            </div>
          </div>
          <div>
            <label className={labelClass}>Max gespreksbeurten</label>
            <input
              type="number"
              min={1}
              max={50}
              value={form.max_turns}
              onChange={e => setForm(prev => ({ ...prev, max_turns: parseInt(e.target.value) || 10 }))}
              className={`${inputClass} max-w-[100px]`}
            />
          </div>
        </div>
      </div>

      {/* Voice */}
      <div className="border-t border-border pt-5">
        <h3 className="text-[14px] font-bold mb-3">Voice</h3>
        <div>
          <label className={labelClass}>Voice ID</label>
          <input
            value={form.voice_id}
            onChange={e => setForm(prev => ({ ...prev, voice_id: e.target.value }))}
            className={inputClass}
            placeholder="ElevenLabs of TTS voice ID"
          />
          <p className="text-[11px] text-muted-foreground mt-1">ElevenLabs of TTS voice ID voor telefonische gesprekken</p>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-5 py-2.5 bg-primary text-primary-foreground rounded-sm text-[13px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50"
      >
        {saving ? "Opslaan..." : "Opslaan"}
      </button>
    </div>
  );
};

/* ---- Routing Rule Row ---- */
const RoutingRuleRow = ({ rule, onChange, onRemove }: {
  rule: RoutingRule;
  onChange: (patch: Partial<RoutingRule>) => void;
  onRemove: () => void;
}) => {
  const [kwInput, setKwInput] = useState("");

  const addKeyword = () => {
    const kw = kwInput.trim();
    if (kw && !rule.keywords.includes(kw)) {
      onChange({ keywords: [...rule.keywords, kw] });
      setKwInput("");
    }
  };
  const removeKeyword = (idx: number) => onChange({ keywords: rule.keywords.filter((_, i) => i !== idx) });

  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Select value={rule.department} onValueChange={v => onChange({ department: v })}>
            <SelectTrigger className="text-xs w-[130px] h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="werkplaats">Werkplaats</SelectItem>
              <SelectItem value="verkoop">Verkoop</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Select value={rule.priority} onValueChange={v => onChange({ priority: v })}>
            <SelectTrigger className="text-xs w-[100px] h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="laag">Laag</SelectItem>
              <SelectItem value="normaal">Normaal</SelectItem>
              <SelectItem value="hoog">Hoog</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <button onClick={onRemove} className="text-muted-foreground hover:text-destructive">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {rule.keywords.map((kw, i) => (
          <Badge key={i} variant="secondary" className="gap-1 text-xs">
            {kw}
            <button onClick={() => removeKeyword(i)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={kwInput}
          onChange={e => setKwInput(e.target.value)}
          placeholder="Keyword..."
          className="text-xs h-8"
          onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addKeyword())}
        />
        <Button size="sm" variant="outline" onClick={addKeyword} className="h-8 px-2" disabled={!kwInput.trim()}>+</Button>
      </div>
    </div>
  );
};

export default SettingsAiAgentTab;
