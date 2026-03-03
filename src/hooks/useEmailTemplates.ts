import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface EmailTemplate {
  id: string;
  company_id: string;
  name: string;
  subject: string | null;
  html_body: string;
  variables: string[];
  created_at: string;
  updated_at: string;
}

const DEFAULT_TEMPLATES: Omit<EmailTemplate, "id" | "company_id" | "created_at" | "updated_at">[] = [
  {
    name: "Werkbon afgerond",
    subject: "Werkbon {{werkbonnummer}} is afgerond",
    variables: ["klantnaam", "werkbonnummer", "bedrag", "datum", "bedrijfsnaam"],
    html_body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff;">
  <div style="text-align:center;padding-bottom:16px;border-bottom:2px solid #e5e7eb;margin-bottom:24px;">
    <h2 style="margin:0;color:#1f2937;">{{bedrijfsnaam}}</h2>
  </div>
  <p style="color:#374151;font-size:15px;">Beste {{klantnaam}},</p>
  <p style="color:#374151;font-size:15px;">Hierbij bevestigen wij dat werkbon <strong>{{werkbonnummer}}</strong> is afgerond op {{datum}}.</p>
  <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:20px 0;">
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="color:#6b7280;padding:4px 0;">Werkbon</td><td style="text-align:right;font-weight:600;color:#1f2937;">{{werkbonnummer}}</td></tr>
      <tr><td style="color:#6b7280;padding:4px 0;">Datum</td><td style="text-align:right;color:#1f2937;">{{datum}}</td></tr>
      <tr><td style="color:#6b7280;padding:4px 0;">Bedrag</td><td style="text-align:right;font-weight:600;color:#1f2937;">{{bedrag}}</td></tr>
    </table>
  </div>
  <p style="color:#374151;font-size:15px;">Heeft u vragen? Neem gerust contact met ons op.</p>
  <p style="color:#374151;font-size:15px;">Met vriendelijke groet,<br/><strong>{{bedrijfsnaam}}</strong></p>
</div>`,
  },
  {
    name: "Factuur verzonden",
    subject: "Factuur {{factuurnummer}} — {{bedrijfsnaam}}",
    variables: ["klantnaam", "factuurnummer", "bedrag", "datum", "bedrijfsnaam"],
    html_body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff;">
  <div style="text-align:center;padding-bottom:16px;border-bottom:2px solid #e5e7eb;margin-bottom:24px;">
    <h2 style="margin:0;color:#1f2937;">{{bedrijfsnaam}}</h2>
  </div>
  <p style="color:#374151;font-size:15px;">Beste {{klantnaam}},</p>
  <p style="color:#374151;font-size:15px;">Bijgaand vindt u factuur <strong>{{factuurnummer}}</strong> ter hoogte van <strong>{{bedrag}}</strong>.</p>
  <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:20px 0;">
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="color:#6b7280;padding:4px 0;">Factuurnummer</td><td style="text-align:right;font-weight:600;color:#1f2937;">{{factuurnummer}}</td></tr>
      <tr><td style="color:#6b7280;padding:4px 0;">Datum</td><td style="text-align:right;color:#1f2937;">{{datum}}</td></tr>
      <tr><td style="color:#6b7280;padding:4px 0;">Bedrag</td><td style="text-align:right;font-weight:600;color:#1f2937;">{{bedrag}}</td></tr>
    </table>
  </div>
  <p style="color:#374151;font-size:15px;">Wij verzoeken u het bedrag binnen 14 dagen over te maken.</p>
  <p style="color:#374151;font-size:15px;">Met vriendelijke groet,<br/><strong>{{bedrijfsnaam}}</strong></p>
</div>`,
  },
  {
    name: "Reviewverzoek",
    subject: "Hoe was onze service? — {{bedrijfsnaam}}",
    variables: ["klantnaam", "bedrijfsnaam", "datum"],
    html_body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff;">
  <div style="text-align:center;padding-bottom:16px;border-bottom:2px solid #e5e7eb;margin-bottom:24px;">
    <h2 style="margin:0;color:#1f2937;">{{bedrijfsnaam}}</h2>
  </div>
  <p style="color:#374151;font-size:15px;">Beste {{klantnaam}},</p>
  <p style="color:#374151;font-size:15px;">Onlangs hebben wij werkzaamheden voor u uitgevoerd. Wij hopen dat u tevreden bent met het resultaat!</p>
  <p style="color:#374151;font-size:15px;">Zou u een moment de tijd willen nemen om een review achter te laten? Uw feedback helpt ons om onze service te verbeteren.</p>
  <p style="color:#374151;font-size:15px;">Alvast hartelijk dank!</p>
  <p style="color:#374151;font-size:15px;">Met vriendelijke groet,<br/><strong>{{bedrijfsnaam}}</strong></p>
</div>`,
  },
];

async function seedDefaultTemplates(companyId: string) {
  const { data: existing } = await supabase
    .from("email_templates" as any)
    .select("name")
    .eq("company_id", companyId);

  const existingNames = new Set((existing || []).map((t: any) => t.name));
  const toInsert = DEFAULT_TEMPLATES.filter((t) => !existingNames.has(t.name));

  if (toInsert.length > 0) {
    await supabase
      .from("email_templates" as any)
      .insert(toInsert.map((t) => ({ ...t, company_id: companyId })) as any);
  }
}

export function useEmailTemplates() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["email_templates", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      // Seed defaults on first load
      await seedDefaultTemplates(companyId!);

      const { data, error } = await supabase
        .from("email_templates" as any)
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as EmailTemplate[];
    },
  });
}

export function useCreateEmailTemplate() {
  const { companyId } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (template: Pick<EmailTemplate, "name" | "subject" | "html_body" | "variables">) => {
      const { error } = await supabase
        .from("email_templates" as any)
        .insert({ ...template, company_id: companyId } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email_templates"] }),
  });
}

export function useUpdateEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<EmailTemplate> & { id: string }) => {
      const { error } = await supabase
        .from("email_templates" as any)
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email_templates"] }),
  });
}

export function useDeleteEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("email_templates" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email_templates"] }),
  });
}
