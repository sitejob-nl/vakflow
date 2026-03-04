import { useAuth } from "@/contexts/AuthContext";
import { industryConfig, getIndustryLabels, type Industry, type IndustryConfig, type IndustryLabels } from "@/config/industryConfig";

export function useIndustryConfig() {
  const { industry, subcategory } = useAuth();
  
  const safeIndustry: Industry = (industry as Industry) || "technical";
  const config: IndustryConfig = industryConfig[safeIndustry] ?? industryConfig.technical;
  const labels: IndustryLabels = getIndustryLabels(safeIndustry, subcategory);

  return { config, labels, industry: safeIndustry, subcategory };
}
