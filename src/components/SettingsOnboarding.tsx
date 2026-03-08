import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { differenceInDays } from "date-fns";
import { Check, Circle, ArrowRight } from "lucide-react";
import { useNavigation } from "@/hooks/useNavigation";

interface Step {
  label: string;
  done: boolean;
  action?: () => void;
  optional?: boolean;
}

const SettingsOnboarding = ({ onTabChange }: { onTabChange?: (tab: string) => void }) => {
  const { companyId } = useAuth();
  const { navigate } = useNavigation();

  const { data } = useQuery({
    queryKey: ["settings-onboarding", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const [companyRes, customersRes, quotesRes] = await Promise.all([
        supabase.from("companies").select("name, address, kvk_number, btw_number, logo_url, smtp_email, outlook_email, accounting_provider, created_at").eq("id", companyId).single(),
        supabase.from("customers").select("id").eq("company_id", companyId).limit(1),
        supabase.from("quotes").select("id").eq("company_id", companyId).eq("status", "verzonden").limit(1),
      ]);
      const c = companyRes.data as any;
      if (!c) return null;
      const age = differenceInDays(new Date(), new Date(c.created_at));
      if (age > 7) return null;

      return {
        companyDetails: !!(c.name && c.address && c.kvk_number && c.btw_number),
        logoUploaded: !!c.logo_url,
        emailConfigured: !!(c.smtp_email || c.outlook_email),
        firstCustomer: (customersRes.data?.length ?? 0) > 0,
        firstQuoteSent: (quotesRes.data?.length ?? 0) > 0,
        accountingConfigured: !!c.accounting_provider,
      };
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });

  if (!data) return null;

  const steps: Step[] = [
    { label: "Bedrijfsgegevens ingevuld", done: data.companyDetails, action: () => onTabChange?.("Bedrijfsgegevens") },
    { label: "Logo geüpload", done: data.logoUploaded, action: () => onTabChange?.("Bedrijfsgegevens") },
    { label: "E-mail geconfigureerd", done: data.emailConfigured, action: () => onTabChange?.("E-mail") },
    { label: "Eerste klant aangemaakt", done: data.firstCustomer, action: () => navigate("customers") },
    { label: "Eerste offerte verstuurd", done: data.firstQuoteSent, action: () => navigate("quotes") },
    { label: "Boekhoudkoppeling (optioneel)", done: data.accountingConfigured, action: () => onTabChange?.("Boekhouding"), optional: true },
  ];

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;

  return (
    <div className="bg-primary-muted border border-primary/20 rounded-lg p-4 md:p-5 mb-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[14px] font-bold">🚀 Aan de slag</h3>
        <span className="text-[12px] font-bold text-primary">{completed}/{total}</span>
      </div>
      <div className="w-full bg-border rounded-full h-1.5 mb-4">
        <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${(completed / total) * 100}%` }} />
      </div>
      <div className="space-y-2">
        {steps.map((step) => (
          <div key={step.label} className="flex items-center gap-2.5">
            {step.done ? (
              <Check className="h-4 w-4 text-accent flex-shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
            <span className={`text-[13px] flex-1 ${step.done ? "text-muted-foreground line-through" : "font-semibold"}`}>
              {step.label}
            </span>
            {!step.done && step.action && (
              <button onClick={step.action} className="text-[11px] text-primary font-bold hover:underline flex items-center gap-0.5">
                Ga <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SettingsOnboarding;
