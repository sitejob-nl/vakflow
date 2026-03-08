import { useState } from "react";
import { useEmailTemplates, useCreateEmailTemplate, useUpdateEmailTemplate, useDeleteEmailTemplate, EmailTemplate } from "@/hooks/useEmailTemplates";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import EmailTemplateEditor from "@/components/EmailTemplateEditor";
import { SETTINGS_INPUT_CLASS as inputClass, SETTINGS_LABEL_CLASS as labelClass } from "./shared";

const SettingsEmailTemplatesTab = () => {
  const { data: templates, isLoading } = useEmailTemplates();
  const createTemplate = useCreateEmailTemplate();
  const updateTemplate = useUpdateEmailTemplate();
  const deleteTemplate = useDeleteEmailTemplate();
  const { toast } = useToast();

  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [saving, setSaving] = useState(false);

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setName("");
    setSubject("");
    setHtmlBody("");
  };

  const startEdit = (t: EmailTemplate) => {
    setEditing(t);
    setCreating(false);
    setName(t.name);
    setSubject(t.subject ?? "");
    setHtmlBody(t.html_body);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await updateTemplate.mutateAsync({ id: editing.id, name, subject, html_body: htmlBody });
        toast({ title: "Template bijgewerkt" });
      } else {
        await createTemplate.mutateAsync({ name, subject, html_body: htmlBody, variables: [] });
        toast({ title: "Template aangemaakt" });
      }
      setEditing(null);
      setCreating(false);
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Weet je zeker dat je dit template wilt verwijderen?")) return;
    try {
      await deleteTemplate.mutateAsync(id);
      toast({ title: "Template verwijderd" });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const handleCancel = () => {
    setEditing(null);
    setCreating(false);
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (editing || creating) {
    return (
      <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6">
        <EmailTemplateEditor
          name={name}
          subject={subject}
          htmlBody={htmlBody}
          onNameChange={setName}
          onSubjectChange={setSubject}
          onHtmlBodyChange={setHtmlBody}
          onSave={handleSave}
          onCancel={handleCancel}
          saving={saving}
          inputClass={inputClass}
          labelClass={labelClass}
        />
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold">E-mail Templates</h3>
        <button onClick={startCreate} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-sm text-[12px] font-bold hover:bg-primary-hover transition-colors">
          <Plus className="h-3.5 w-3.5" /> Nieuw template
        </button>
      </div>

      {(!templates || templates.length === 0) ? (
        <p className="text-[13px] text-muted-foreground">Nog geen templates. Maak er een aan.</p>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="flex items-center justify-between p-3 border border-border rounded-sm bg-background">
              <div>
                <p className="text-[13px] font-bold">{t.name}</p>
                {t.subject && <p className="text-[11px] text-muted-foreground">{t.subject}</p>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => startEdit(t)} className="p-2 hover:bg-secondary rounded-sm transition-colors"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                <button onClick={() => handleDelete(t.id)} className="p-2 hover:bg-destructive/10 rounded-sm transition-colors"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SettingsEmailTemplatesTab;
