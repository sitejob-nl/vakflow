import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  Eye, Code, Plus, Trash2, ChevronUp, ChevronDown, Type, Table, MousePointerClick,
  Minus, Image, AlignLeft, GripVertical,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// ── Types ──────────────────────────────────────────────────────────────────

type BlockType = "header" | "text" | "info_table" | "button" | "divider" | "footer";

interface InfoRow { label: string; value: string }

interface EmailBlock {
  id: string;
  type: BlockType;
  content: string;
  settings: {
    rows?: InfoRow[];
    buttonUrl?: string;
    buttonText?: string;
  };
}

const AVAILABLE_VARIABLES = [
  { key: "{{klantnaam}}", label: "Klantnaam" },
  { key: "{{werkbonnummer}}", label: "Werkbonnummer" },
  { key: "{{factuurnummer}}", label: "Factuurnummer" },
  { key: "{{bedrag}}", label: "Bedrag" },
  { key: "{{datum}}", label: "Datum" },
  { key: "{{bedrijfsnaam}}", label: "Bedrijfsnaam" },
  { key: "{{adres}}", label: "Adres" },
];

// ── Block CRUD helpers ─────────────────────────────────────────────────────

const uid = () => crypto.randomUUID();

function defaultBlock(type: BlockType): EmailBlock {
  switch (type) {
    case "header":
      return { id: uid(), type, content: "{{bedrijfsnaam}}", settings: {} };
    case "text":
      return { id: uid(), type, content: "Beste {{klantnaam}},\n\nTyp hier uw bericht...", settings: {} };
    case "info_table":
      return {
        id: uid(), type, content: "",
        settings: { rows: [{ label: "Werkbon", value: "{{werkbonnummer}}" }, { label: "Bedrag", value: "{{bedrag}}" }] },
      };
    case "button":
      return { id: uid(), type, content: "", settings: { buttonText: "Bekijk details", buttonUrl: "https://" } };
    case "divider":
      return { id: uid(), type, content: "", settings: {} };
    case "footer":
      return { id: uid(), type, content: "{{bedrijfsnaam}} — {{adres}}", settings: {} };
  }
}

const BLOCK_LABELS: Record<BlockType, { label: string; icon: typeof Type }> = {
  header: { label: "Header", icon: Image },
  text: { label: "Tekst", icon: Type },
  info_table: { label: "Info-tabel", icon: Table },
  button: { label: "Knop", icon: MousePointerClick },
  divider: { label: "Scheidingslijn", icon: Minus },
  footer: { label: "Footer", icon: AlignLeft },
};

// ── HTML Generation ────────────────────────────────────────────────────────

const BUILDER_MARKER = "<!-- vakflow-builder-v1 -->";

function blocksToHtml(blocks: EmailBlock[], brandColor: string | null, logoUrl: string | null): string {
  const color = brandColor || "#4f46e5";
  const sections = blocks.map((b) => {
    switch (b.type) {
      case "header": {
        const logo = logoUrl
          ? `<img src="${logoUrl}" alt="Logo" style="max-height:56px;margin-bottom:12px;" />`
          : "";
        return `<tr><td style="background:${color};padding:24px 32px;text-align:center;">
          ${logo}
          <h1 style="color:#ffffff;margin:0;font-size:20px;font-family:Arial,sans-serif;">${b.content}</h1>
        </td></tr>`;
      }
      case "text":
        return `<tr><td style="padding:24px 32px;">
          <p style="font-size:15px;color:#333333;line-height:1.6;margin:0;font-family:Arial,sans-serif;white-space:pre-line;">${b.content}</p>
        </td></tr>`;
      case "info_table": {
        const rows = (b.settings.rows || [])
          .map((r) => `<tr><td style="padding:6px 0;color:#666;font-size:14px;font-family:Arial,sans-serif;">${r.label}</td><td style="padding:6px 0;font-size:14px;font-weight:600;font-family:Arial,sans-serif;">${r.value}</td></tr>`)
          .join("");
        return `<tr><td style="padding:16px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>
        </td></tr>`;
      }
      case "button":
        return `<tr><td style="padding:16px 32px;text-align:center;">
          <a href="${b.settings.buttonUrl || "#"}" style="display:inline-block;background:${color};color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;font-family:Arial,sans-serif;">${b.settings.buttonText || "Klik hier"}</a>
        </td></tr>`;
      case "divider":
        return `<tr><td style="padding:8px 32px;"><hr style="border:none;border-top:1px solid #e5e5e5;margin:0;" /></td></tr>`;
      case "footer":
        return `<tr><td style="background:#f9fafb;padding:16px 32px;text-align:center;font-size:12px;color:#888888;font-family:Arial,sans-serif;">${b.content}</td></tr>`;
      default:
        return "";
    }
  }).join("\n");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" />${BUILDER_MARKER}</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
        ${sections}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function htmlToBlocks(html: string): EmailBlock[] | null {
  if (!html.includes(BUILDER_MARKER)) return null; // legacy HTML
  // Not parseable back — return null so we fall back to HTML mode for legacy templates
  return null;
}

function createDefaultBlocks(): EmailBlock[] {
  return [
    defaultBlock("header"),
    defaultBlock("text"),
    defaultBlock("info_table"),
    defaultBlock("divider"),
    defaultBlock("footer"),
  ];
}

// ── Exports (keep backward compat) ─────────────────────────────────────────

const DEFAULT_TEMPLATE = (logoUrl: string | null, brandColor: string | null) =>
  blocksToHtml(createDefaultBlocks(), brandColor, logoUrl);

export { DEFAULT_TEMPLATE, AVAILABLE_VARIABLES };

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  name: string;
  subject: string;
  htmlBody: string;
  onNameChange: (v: string) => void;
  onSubjectChange: (v: string) => void;
  onHtmlBodyChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving?: boolean;
  inputClass: string;
  labelClass: string;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function EmailTemplateEditor({
  name, subject, htmlBody, onNameChange, onSubjectChange, onHtmlBodyChange,
  onSave, onCancel, saving, inputClass, labelClass,
}: Props) {
  const { companyLogoUrl, companyBrandColor } = useAuth();
  const [blocks, setBlocks] = useState<EmailBlock[]>(() => createDefaultBlocks());
  const [mode, setMode] = useState<"builder" | "preview" | "html">("builder");
  const [isLegacyHtml, setIsLegacyHtml] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const initialized = useRef(false);

  // Sync blocks → HTML on every block change
  const syncHtml = useCallback((b: EmailBlock[]) => {
    if (!isLegacyHtml) {
      onHtmlBodyChange(blocksToHtml(b, companyBrandColor, companyLogoUrl));
    }
  }, [companyBrandColor, companyLogoUrl, isLegacyHtml, onHtmlBodyChange]);

  // Initialize: try to parse existing HTML to blocks, or use defaults
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (htmlBody && htmlBody.includes(BUILDER_MARKER)) {
      // Builder-generated template — keep blocks as default (we can't reverse-parse yet)
      syncHtml(blocks);
    } else if (htmlBody && htmlBody.trim().length > 20) {
      // Legacy raw HTML template
      setIsLegacyHtml(true);
      setMode("html");
    } else {
      // Empty — initialize with defaults
      syncHtml(blocks);
    }
  }, []);

  // Preview iframe
  useEffect(() => {
    if (mode === "preview" && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) { doc.open(); doc.write(htmlBody); doc.close(); }
    }
  }, [mode, htmlBody]);

  const updateBlock = (id: string, patch: Partial<EmailBlock>) => {
    setBlocks((prev) => {
      const next = prev.map((b) => (b.id === id ? { ...b, ...patch } : b));
      syncHtml(next);
      return next;
    });
  };

  const moveBlock = (index: number, dir: -1 | 1) => {
    setBlocks((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      syncHtml(next);
      return next;
    });
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => {
      const next = prev.filter((b) => b.id !== id);
      syncHtml(next);
      return next;
    });
  };

  const addBlock = (type: BlockType) => {
    setBlocks((prev) => {
      const next = [...prev, defaultBlock(type)];
      syncHtml(next);
      return next;
    });
  };

  const insertVariable = (blockId: string, variable: string) => {
    setBlocks((prev) => {
      const next = prev.map((b) => {
        if (b.id !== blockId) return b;
        return { ...b, content: b.content + variable };
      });
      syncHtml(next);
      return next;
    });
  };

  // ── Block Renderer ─────────────────────────────────────────────────────

  const renderBlock = (block: EmailBlock, index: number) => {
    const Icon = BLOCK_LABELS[block.type].icon;
    return (
      <div key={block.id} className="border border-border rounded-lg bg-card mb-2 group">
        {/* Block toolbar */}
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-muted/30 rounded-t-lg">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            {BLOCK_LABELS[block.type].label}
          </span>
          <div className="ml-auto flex gap-0.5">
            <button type="button" onClick={() => moveBlock(index, -1)} disabled={index === 0}
              className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors">
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1}
              className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors">
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => removeBlock(block.id)}
              className="p-1 rounded hover:bg-destructive/10 text-destructive transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Block content editor */}
        <div className="p-3">
          {(block.type === "header" || block.type === "text" || block.type === "footer") && (
            <div className="space-y-2">
              <textarea
                value={block.content}
                onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                className={`${inputClass} text-[13px] min-h-[60px] resize-y`}
                rows={block.type === "text" ? 4 : 2}
              />
              {/* Variable insert buttons for text blocks */}
              {block.type === "text" && (
                <div className="flex flex-wrap gap-1">
                  {AVAILABLE_VARIABLES.map((v) => (
                    <button key={v.key} type="button" onClick={() => insertVariable(block.id, v.key)}
                      className="px-2 py-0.5 bg-muted text-[10px] font-medium rounded hover:bg-accent/20 transition-colors border border-border">
                      <Plus className="inline h-2.5 w-2.5 mr-0.5" />{v.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {block.type === "info_table" && (
            <div className="space-y-2">
              {(block.settings.rows || []).map((row, ri) => (
                <div key={ri} className="flex gap-2 items-center">
                  <input value={row.label} placeholder="Label"
                    onChange={(e) => {
                      const newRows = [...(block.settings.rows || [])];
                      newRows[ri] = { ...newRows[ri], label: e.target.value };
                      updateBlock(block.id, { settings: { ...block.settings, rows: newRows } });
                    }}
                    className={`${inputClass} text-[13px] flex-1`} />
                  <input value={row.value} placeholder="Waarde of {{variabele}}"
                    onChange={(e) => {
                      const newRows = [...(block.settings.rows || [])];
                      newRows[ri] = { ...newRows[ri], value: e.target.value };
                      updateBlock(block.id, { settings: { ...block.settings, rows: newRows } });
                    }}
                    className={`${inputClass} text-[13px] flex-1`} />
                  <button type="button" onClick={() => {
                    const newRows = (block.settings.rows || []).filter((_, i) => i !== ri);
                    updateBlock(block.id, { settings: { ...block.settings, rows: newRows } });
                  }} className="p-1 text-destructive hover:bg-destructive/10 rounded">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => {
                const newRows = [...(block.settings.rows || []), { label: "", value: "" }];
                updateBlock(block.id, { settings: { ...block.settings, rows: newRows } });
              }} className="text-[12px] text-primary hover:underline flex items-center gap-1">
                <Plus className="h-3 w-3" /> Rij toevoegen
              </button>
            </div>
          )}

          {block.type === "button" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Tekst</label>
                <input value={block.settings.buttonText || ""} placeholder="Klik hier"
                  onChange={(e) => updateBlock(block.id, { settings: { ...block.settings, buttonText: e.target.value } })}
                  className={`${inputClass} text-[13px]`} />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">URL</label>
                <input value={block.settings.buttonUrl || ""} placeholder="https://..."
                  onChange={(e) => updateBlock(block.id, { settings: { ...block.settings, buttonUrl: e.target.value } })}
                  className={`${inputClass} text-[13px]`} />
              </div>
            </div>
          )}

          {block.type === "divider" && (
            <div className="py-2"><hr className="border-border" /></div>
          )}
        </div>
      </div>
    );
  };

  // ── Main render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Name + Subject */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Templatenaam</label>
          <input value={name} onChange={(e) => onNameChange(e.target.value)} className={inputClass} placeholder="Bijv. Werkbon afgerond" />
        </div>
        <div>
          <label className={labelClass}>Onderwerp</label>
          <input value={subject} onChange={(e) => onSubjectChange(e.target.value)} className={inputClass} placeholder="Bijv. Werkbon {{werkbonnummer}} afgerond" />
        </div>
      </div>

      {/* Subject variable buttons */}
      <div>
        <label className={labelClass}>Variabelen voor onderwerp</label>
        <div className="flex flex-wrap gap-1.5">
          {AVAILABLE_VARIABLES.map((v) => (
            <button key={v.key} type="button"
              onClick={() => onSubjectChange(subject + v.key)}
              className="px-2.5 py-1 bg-muted text-[11px] font-medium rounded hover:bg-accent/20 transition-colors border border-border">
              <Plus className="inline h-3 w-3 mr-0.5" />{v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mode tabs */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
        <TabsList>
          <TabsTrigger value="builder" disabled={isLegacyHtml}>
            <AlignLeft className="h-3.5 w-3.5 mr-1" />Builder
          </TabsTrigger>
          <TabsTrigger value="preview">
            <Eye className="h-3.5 w-3.5 mr-1" />Preview
          </TabsTrigger>
          <TabsTrigger value="html">
            <Code className="h-3.5 w-3.5 mr-1" />HTML
          </TabsTrigger>
        </TabsList>

        <TabsContent value="builder">
          {isLegacyHtml ? (
            <div className="p-4 border border-border rounded bg-muted/50 text-sm text-muted-foreground">
              Dit template is in HTML-modus aangemaakt en kan niet in de builder worden bewerkt. Gebruik het HTML-tabblad.
            </div>
          ) : (
            <div className="space-y-2">
              {blocks.map((block, i) => renderBlock(block, i))}

              {/* Add block buttons */}
              <div className="pt-2 border-t border-border">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Blok toevoegen</p>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(BLOCK_LABELS) as BlockType[]).map((type) => {
                    const { label, icon: BIcon } = BLOCK_LABELS[type];
                    return (
                      <button key={type} type="button" onClick={() => addBlock(type)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md border border-border bg-card hover:bg-muted transition-colors">
                        <BIcon className="h-3.5 w-3.5" />{label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="preview">
          <div className="border border-border rounded-sm bg-background overflow-hidden">
            <iframe ref={iframeRef} title="E-mail preview" sandbox="allow-same-origin"
              className="w-full min-h-[400px] border-0" />
          </div>
        </TabsContent>

        <TabsContent value="html">
          <textarea
            value={htmlBody}
            onChange={(e) => onHtmlBodyChange(e.target.value)}
            className={`${inputClass} font-mono text-[12px] min-h-[400px] resize-y`}
            spellCheck={false}
          />
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button onClick={onSave} disabled={saving || !name}>
          {saving ? "Opslaan..." : "Opslaan"}
        </Button>
        <Button variant="outline" onClick={onCancel}>Annuleren</Button>
      </div>
    </div>
  );
}
