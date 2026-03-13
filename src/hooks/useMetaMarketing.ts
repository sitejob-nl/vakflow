import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMetaMarketing() {
  const queryClient = useQueryClient();

  // Get local config from DB
  const configQuery = useQuery({
    queryKey: ["meta-marketing-config"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("meta-marketing-api", {
        body: { action: "status" },
      });
      if (error) throw error;
      return data as {
        connected: boolean;
        ad_account_id: string | null;
        ad_account_name: string | null;
        page_id: string | null;
        page_name: string | null;
        instagram_id: string | null;
        instagram_username: string | null;
        tenant_id: string | null;
        connect_url: string | null;
      };
    },
  });

  // Register tenant at SiteJob Connect
  const registerTenant = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("meta-marketing-register");
      if (error) throw error;
      return data as { tenant_id: string; connect_url?: string; existing?: boolean };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-marketing-config"] });
    },
  });

  // Campaigns
  const campaignsQuery = useQuery({
    queryKey: ["meta-marketing-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("meta-marketing-api", {
        body: { action: "campaigns" },
      });
      if (error) throw error;
      return data?.data || [];
    },
    enabled: configQuery.data?.connected === true && !!configQuery.data?.ad_account_id,
  });

  // Insights
  const insightsQuery = useQuery({
    queryKey: ["meta-marketing-insights"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("meta-marketing-api", {
        body: { action: "insights", date_preset: "last_30d" },
      });
      if (error) throw error;
      return data?.data?.[0] || null;
    },
    enabled: configQuery.data?.connected === true && !!configQuery.data?.ad_account_id,
  });

  // Instagram media
  const instagramMediaQuery = useQuery({
    queryKey: ["meta-marketing-instagram-media"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("meta-marketing-api", {
        body: { action: "instagram-media" },
      });
      if (error) throw error;
      return data?.data || [];
    },
    enabled: configQuery.data?.connected === true && !!configQuery.data?.instagram_id,
  });

  // Page posts
  const pagePostsQuery = useQuery({
    queryKey: ["meta-marketing-page-posts"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("meta-marketing-api", {
        body: { action: "page-posts" },
      });
      if (error) throw error;
      return data?.data || [];
    },
    enabled: configQuery.data?.connected === true && !!configQuery.data?.page_id,
  });

  // Publish post
  const publishPost = useMutation({
    mutationFn: async (message: string) => {
      const { data, error } = await supabase.functions.invoke("meta-marketing-api", {
        body: { action: "publish-post", message },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-marketing-page-posts"] });
    },
  });

  return {
    configQuery,
    registerTenant,
    campaignsQuery,
    insightsQuery,
    instagramMediaQuery,
    pagePostsQuery,
    publishPost,
  };
}
