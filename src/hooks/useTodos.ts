import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type Todo = {
  id: string;
  user_id: string;
  title: string;
  completed: boolean;
  customer_id: string | null;
  due_date: string | null;
  created_at: string;
  customers?: { name: string } | null;
};

export const useTodos = () => {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["todos", companyId],
    queryFn: async () => {
      let q = supabase
        .from("todos")
        .select("*, customers:customer_id(name)")
        .order("completed", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Todo[];
    },
  });
};

export const useCreateTodo = () => {
  const qc = useQueryClient();
  const { user, companyId } = useAuth();
  return useMutation({
    mutationFn: async (params: { title: string; customer_id?: string | null; due_date?: string | null }) => {
      const { data, error } = await supabase
        .from("todos")
        .insert({ ...params, user_id: user!.id, company_id: companyId } as any)
        .select("*, customers:customer_id(name)")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["todos"] }),
  });
};

export const useToggleTodo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from("todos").update({ completed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["todos"] }),
  });
};

export const useDeleteTodo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("todos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["todos"] }),
  });
};
