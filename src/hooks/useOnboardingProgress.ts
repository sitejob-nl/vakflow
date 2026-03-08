import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface OnboardingStep {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  page: string;
}

export const useOnboardingProgress = () => {
  const { companyId, onboardingCompleted } = useAuth();

  return useQuery({
    queryKey: ["onboarding-progress", companyId],
    queryFn: async () => {
      if (!companyId) return null;

      const [companyRes, servicesRes, customersRes, appointmentsRes] = await Promise.all([
        supabase.from("companies").select("name, address, kvk_number, iban, smtp_email, phone").eq("id", companyId).single(),
        supabase.from("services").select("id").eq("company_id", companyId).limit(1),
        supabase.from("customers").select("id").eq("company_id", companyId).limit(1),
        supabase.from("appointments").select("id").eq("company_id", companyId).limit(1),
      ]);

      const company = companyRes.data;
      const hasCompanyDetails = !!(company?.address && company?.phone);
      const hasService = (servicesRes.data?.length ?? 0) > 0;
      const hasCustomer = (customersRes.data?.length ?? 0) > 0;
      const hasAppointment = (appointmentsRes.data?.length ?? 0) > 0;
      const hasEmail = !!company?.smtp_email;

      const steps: OnboardingStep[] = [
        {
          id: "company",
          label: "Bedrijfsgegevens invullen",
          description: "Vul je adres, telefoon en KVK-nummer in",
          completed: hasCompanyDetails,
          page: "settings",
        },
        {
          id: "service",
          label: "Eerste dienst aanmaken",
          description: "Stel een dienst in die je aanbiedt",
          completed: hasService,
          page: "settings",
        },
        {
          id: "customer",
          label: "Eerste klant toevoegen",
          description: "Voeg je eerste klant toe aan het systeem",
          completed: hasCustomer,
          page: "customers",
        },
        {
          id: "appointment",
          label: "Eerste afspraak plannen",
          description: "Plan een afspraak in op de planning",
          completed: hasAppointment,
          page: "planning",
        },
        {
          id: "email",
          label: "E-mail instellen",
          description: "Koppel je e-mailadres voor communicatie",
          completed: hasEmail,
          page: "settings",
        },
      ];

      const completedCount = steps.filter((s) => s.completed).length;
      const allDone = completedCount === steps.length;

      return { steps, completedCount, totalSteps: steps.length, allDone };
    },
    enabled: !!companyId && !onboardingCompleted,
    staleTime: 60_000,
  });
};
