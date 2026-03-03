import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useMetaLeads() {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();

  const leadsQuery = useQuery({
    queryKey: ["meta-leads", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meta_leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("meta_leads")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meta-leads"] }),
  });

  const convertToCustomer = useMutation({
    mutationFn: async ({ leadId, name, email, phone }: { leadId: string; name: string; email?: string; phone?: string }) => {
      const { data: customer, error: custErr } = await supabase
        .from("customers")
        .insert({ name, email, phone, company_id: companyId })
        .select()
        .single();
      if (custErr) throw custErr;

      const { error: leadErr } = await supabase
        .from("meta_leads")
        .update({ status: "klant", customer_id: customer.id })
        .eq("id", leadId);
      if (leadErr) throw leadErr;

      return customer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-leads"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });

  const fetchLeadDetails = useMutation({
    mutationFn: async (leadId: string) => {
      const { data, error } = await supabase.functions.invoke("meta-api", {
        body: { action: "fetch-lead-details", lead_id: leadId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meta-leads"] }),
  });

  return { leadsQuery, updateStatus, convertToCustomer, fetchLeadDetails };
}
