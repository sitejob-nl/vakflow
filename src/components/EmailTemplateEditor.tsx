import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, Code, Plus } from "lucide-react";

const AVAILABLE_VARIABLES = [
  { key: "{{klantnaam}}", label: "Klantnaam" },
  { key: "{{werkbonnummer}}", label: "Werkbonnummer" },
  { key: "{{factuurnummer}}", label: "Factuurnummer" },
  { key: "{{bedrag}}", label: "Bedrag" },
  { key: "{{datum}}", label: "Datum" },
  { key: "{{bedrijfsnaam}}", label: "Bedrijfsnaam" },
  { key: "{{adres}}", label: "Adres" },
];

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

const DEFAULT_TEMPLATE = (logoUrl: string | null, brandColor: string | null) => {
  const color = brandColor || "#2563eb";
  const logo = logoUrl
    ? `<img src="${logoUrl}" alt="Logo" style="max-height:60px;margin-bottom:16px;" />`
    : "";
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:${color};padding:24px 32px;text-align:center;">
          ${logo}
          <h1 style="color:#ffffff;margin:0;font-size:20px;">{{bedrijfsnaam}}</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="font-size:15px;color:#333;line-height:1.6;">
            Beste {{klantnaam}},
          </p>
          <p style="font-size:15px;color:#333;line-height:1.6;">
            Typ hier uw bericht...
          </p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:16px 32px;text-align:center;font-size:12px;color:#888;">
          {{bedrijfsnaam}} — {{adres}}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

export { DEFAULT_TEMPLATE, AVAILABLE_VARIABLES };

export default function EmailTemplateEditor({
  name, subject, htmlBody, onNameChange, onSubjectChange, onHtmlBodyChange,
  onSave, onCancel, saving, inputClass, labelClass,
}: Props) {
  const { companyLogoUrl, companyBrandColor } = useAuth();
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize with default template if empty
  useEffect(() => {
    if (!htmlBody) {
      onHtmlBodyChange(DEFAULT_TEMPLATE(companyLogoUrl, companyBrandColor));
    }
  }, []);

  useEffect(() => {
    if (tab === "preview" && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(htmlBody);
        doc.close();
      }
    }
  }, [tab, htmlBody]);

  const insertVariable = (variable: string) => {
    if (textareaRef.current) {
      const ta = textareaRef.current;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newVal = htmlBody.substring(0, start) + variable + htmlBody.substring(end);
      onHtmlBodyChange(newVal);
      setTimeout(() => {
        ta.selectionStart = ta.selectionEnd = start + variable.length;
        ta.focus();
      }, 0);
    } else {
      onHtmlBodyChange(htmlBody + variable);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Templatenaaam</label>
          <input value={name} onChange={(e) => onNameChange(e.target.value)} className={inputClass} placeholder="Bijv. Werkbon afgerond" />
        </div>
        <div>
          <label className={labelClass}>Onderwerp</label>
          <input value={subject} onChange={(e) => onSubjectChange(e.target.value)} className={inputClass} placeholder="Bijv. Werkbon {{werkbonnummer}} afgerond" />
        </div>
      </div>

      {/* Variable buttons */}
      <div>
        <label className={labelClass}>Variabelen invoegen</label>
        <div className="flex flex-wrap gap-1.5">
          {AVAILABLE_VARIABLES.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => insertVariable(v.key)}
              className="px-2.5 py-1 bg-muted text-[11px] font-medium rounded hover:bg-accent transition-colors border border-border"
            >
              <Plus className="inline h-3 w-3 mr-0.5" />
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 border-b border-border pb-0">
        <button
          type="button"
          onClick={() => setTab("edit")}
          className={`px-3 py-1.5 text-[12px] font-bold rounded-t transition-colors ${tab === "edit" ? "bg-background border border-b-0 border-border text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Code className="inline h-3.5 w-3.5 mr-1" />HTML
        </button>
        <button
          type="button"
          onClick={() => setTab("preview")}
          className={`px-3 py-1.5 text-[12px] font-bold rounded-t transition-colors ${tab === "preview" ? "bg-background border border-b-0 border-border text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Eye className="inline h-3.5 w-3.5 mr-1" />Preview
        </button>
      </div>

      {tab === "edit" ? (
        <textarea
          ref={textareaRef}
          value={htmlBody}
          onChange={(e) => onHtmlBodyChange(e.target.value)}
          className={`${inputClass} font-mono text-[12px] min-h-[400px] resize-y`}
          spellCheck={false}
        />
      ) : (
        <div className="border border-border rounded-sm bg-background overflow-hidden">
          <iframe
            ref={iframeRef}
            title="E-mail preview"
            sandbox="allow-same-origin"
            className="w-full min-h-[400px] border-0"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button onClick={onSave} disabled={saving || !name}>
          {saving ? "Opslaan..." : "Opslaan"}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Annuleren
        </Button>
      </div>
    </div>
  );
}
