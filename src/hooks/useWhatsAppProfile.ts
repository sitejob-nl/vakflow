import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WhatsAppBusinessProfile {
  about?: string;
  address?: string;
  description?: string;
  email?: string;
  profile_picture_url?: string;
  websites?: string[];
  vertical?: string;
}

export function useWhatsAppProfile(enabled = true) {
  return useQuery<WhatsAppBusinessProfile>({
    queryKey: ["whatsapp-business-profile"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-business-profile", {
        body: { action: "get" },
      });
      if (error) throw new Error("Profiel ophalen mislukt");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useUpdateWhatsAppProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (fields: Partial<WhatsAppBusinessProfile>) => {
      const { data, error } = await supabase.functions.invoke("whatsapp-business-profile", {
        body: { action: "update", ...fields },
      });
      if (error) throw new Error("Profiel bijwerken mislukt");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-business-profile"] });
    },
  });
}

export function useUploadWhatsAppProfilePhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]); // strip data:...;base64,
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("whatsapp-business-profile", {
        body: {
          action: "upload_photo",
          file_base64: base64,
          file_type: file.type,
          file_name: file.name,
        },
      });
      if (error) throw new Error("Foto uploaden mislukt");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-business-profile"] });
    },
  });
}
