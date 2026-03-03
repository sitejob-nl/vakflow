import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useMetaPagePosts() {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();

  const postsQuery = useQuery({
    queryKey: ["meta-page-posts", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meta_page_posts")
        .select("*")
        .order("created_time", { ascending: false })
        .limit(25);
      if (error) throw error;
      return data;
    },
  });

  const fetchPosts = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("meta-api", {
        body: { action: "fetch-posts" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meta-page-posts"] }),
  });

  const publishPost = useMutation({
    mutationFn: async (message: string) => {
      const { data, error } = await supabase.functions.invoke("meta-api", {
        body: { action: "publish-post", message },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-page-posts"] });
    },
  });

  const pageInsights = useQuery({
    queryKey: ["meta-page-insights", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("meta-api", {
        body: { action: "page-insights" },
      });
      if (error) return null;
      return data;
    },
  });

  return { postsQuery, fetchPosts, publishPost, pageInsights };
}
