import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Camera, X, Loader2 } from "lucide-react";
import { getSignedUrl } from "@/utils/storageUtils";

interface PhotoUploadProps {
  workOrderId: string;
  type: "before" | "after";
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
}

const BUCKET = "work-order-photos";

const PhotoUpload = ({ workOrderId, type, photos, onPhotosChange }: PhotoUploadProps) => {
  const { toast } = useToast();
  const { companyId } = useAuth();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // Generate signed URLs for all photos
  useEffect(() => {
    let cancelled = false;
    const loadUrls = async () => {
      const urls: Record<string, string> = {};
      for (const photo of photos) {
        const url = await getSignedUrl(BUCKET, photo);
        if (url && !cancelled) urls[photo] = url;
      }
      if (!cancelled) setSignedUrls(urls);
    };
    if (photos.length > 0) loadUrls();
    return () => { cancelled = true; };
  }, [photos]);

  const upload = async (files: FileList) => {
    setUploading(true);
    const newPaths: string[] = [];

    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${companyId}/${workOrderId}/${type}/${crypto.randomUUID()}.${ext}`;

        const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });
        if (error) throw error;

        // Store just the path, not the full URL
        newPaths.push(path);
      }

      onPhotosChange([...photos, ...newPaths]);
      toast({ title: `${newPaths.length} foto('s) geüpload` });
    } catch (err: any) {
      toast({ title: "Upload mislukt", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removePhoto = (index: number) => {
    const updated = photos.filter((_, i) => i !== index);
    onPhotosChange(updated);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[11px] uppercase tracking-widest text-t3 font-bold">
          {type === "before" ? "Foto's vóór" : "Foto's na"}
        </h4>
        <span className="text-[11px] font-bold text-t3">{photos.length}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        {photos.map((photo, i) => (
          <div key={i} className="relative group aspect-square rounded-sm overflow-hidden border border-border">
            <img src={signedUrls[photo] || ""} alt="" className="w-full h-full object-cover" />
            <button
              onClick={() => removePhoto(i)}
              className="absolute top-1 right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="aspect-square rounded-sm border-2 border-dashed border-border flex flex-col items-center justify-center text-t3 hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Camera className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-bold">Toevoegen</span>
            </>
          )}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files && upload(e.target.files)}
      />
    </div>
  );
};

export default PhotoUpload;
