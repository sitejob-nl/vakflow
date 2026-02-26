import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Address = {
  id: string;
  customer_id: string;
  street: string | null;
  house_number: string | null;
  apartment: string | null;
  postal_code: string | null;
  city: string | null;
  notes: string | null;
  last_service_date: string | null;
  created_at: string;
};

export const useAddresses = (customerId: string | undefined) => {
  return useQuery({
    queryKey: ["addresses", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addresses")
        .select("*")
        .eq("customer_id", customerId!)
        .order("street");
      if (error) throw error;
      return data as Address[];
    },
  });
};

export const useCreateAddress = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (address: Omit<Address, "id" | "created_at" | "last_service_date">) => {
      const { data, error } = await supabase.from("addresses").insert(address).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["addresses", vars.customer_id] }),
  });
};

export const useUpdateAddress = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, customer_id, ...updates }: Partial<Address> & { id: string; customer_id: string }) => {
      const { data, error } = await supabase.from("addresses").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["addresses", vars.customer_id] }),
  });
};

export const useDeleteAddress = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, customer_id }: { id: string; customer_id: string }) => {
      const { error } = await supabase.from("addresses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["addresses", vars.customer_id] }),
  });
};
