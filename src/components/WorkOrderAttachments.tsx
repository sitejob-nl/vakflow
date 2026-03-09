import { useState, useRef } from "react";
import { Paperclip, Plus, Trash2, Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUpdateWorkOrder } from "@/hooks/useWorkOrders";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Attachment {
  name: string;
  path: string;
  size: number;
  uploaded_at: string;
}

interface Props {
  workOrderId: string;
  attachments: Attachment[];
  companyId: string;
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function WorkOrderAttachments({ workOrderId, attachments, companyId }: Props) {
  const { toast } = useToast();
  const updateWO = useUpdateWorkOrder();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingIndex, setDownloadingIndex] = useState<number | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setUploading(true);
    const newAttachments: Attachment[] = [...attachments];
    
    for (const file of Array.from(files)) {
      try {
        const ext = file.name.split(".").pop() || "bin";
        const path = `${companyId}/${workOrderId}/attachments/${Date.now()}_${file.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from("work-order-photos")
          .upload(path, file);
        
        if (uploadError) throw uploadError;
        
        newAttachments.push({
          name: file.name,
          path,
          size: file.size,
          uploaded_at: new Date().toISOString(),
        });
      } catch (err: any) {
        toast({ title: `Upload mislukt: ${file.name}`, description: err.message, variant: "destructive" });
      }
    }
    
    try {
      await updateWO.mutateAsync({ id: workOrderId, attachments: newAttachments } as any);
      toast({ title: "Bijlage(n) toegevoegd" });
    } catch (err: any) {
      toast({ title: "Fout bij opslaan", description: err.message, variant: "destructive" });
    }
    
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownload = async (att: Attachment, index: number) => {
    setDownloadingIndex(index);
    try {
      const { data, error } = await supabase.storage
        .from("work-order-photos")
        .createSignedUrl(att.path, 60);
      
      if (error) throw error;
      
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = att.name;
      a.target = "_blank";
      a.click();
    } catch (err: any) {
      toast({ title: "Download mislukt", description: err.message, variant: "destructive" });
    }
    setDownloadingIndex(null);
  };

  const handleDelete = async (index: number) => {
    const att = attachments[index];
    try {
      await supabase.storage.from("work-order-photos").remove([att.path]);
      const newAttachments = attachments.filter((_, i) => i !== index);
      await updateWO.mutateAsync({ id: workOrderId, attachments: newAttachments } as any);
      toast({ title: "Bijlage verwijderd" });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="bg-background border border-border rounded-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[11px] uppercase tracking-widest text-t3 font-bold flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5" /> Bijlagen
        </h4>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary-hover transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Toevoegen
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.txt"
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {attachments.length === 0 && (
        <p className="text-[13px] text-t3 italic">Geen bijlagen</p>
      )}

      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((att, i) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-muted/30 rounded-sm">
              <FileText className="h-4 w-4 text-t3 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium truncate">{att.name}</p>
                <p className="text-[10px] text-t3">{formatFileSize(att.size)}</p>
              </div>
              <button
                onClick={() => handleDownload(att, i)}
                disabled={downloadingIndex === i}
                className="p-1.5 text-t3 hover:text-primary transition-colors"
                title="Downloaden"
              >
                {downloadingIndex === i ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                onClick={() => handleDelete(i)}
                className="p-1.5 text-t3 hover:text-destructive transition-colors"
                title="Verwijderen"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
