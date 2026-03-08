import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, Clock, Wrench } from "lucide-react";

interface PublicWorkOrder {
  work_order_number: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  customer_name: string | null;
  service_name: string | null;
  company_name: string | null;
  company_logo: string | null;
  company_color: string | null;
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; bg: string; text: string }> = {
  open: { label: "Ingepland", icon: Clock, bg: "bg-blue-50", text: "text-blue-700" },
  bezig: { label: "In uitvoering", icon: Wrench, bg: "bg-amber-50", text: "text-amber-700" },
  afgerond: { label: "Afgerond", icon: CheckCircle2, bg: "bg-emerald-50", text: "text-emerald-700" },
};

const WorkOrderStatusPage = () => {
  const { token } = useParams<{ token: string }>();
  const [wo, setWo] = useState<PublicWorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    if (!token) return;
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("work-order-public", {
        body: null,
        method: "GET",
      // @ts-ignore - query params workaround
      } as any);

      // Use fetch directly since functions.invoke doesn't support query params well
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/work-order-public?token=${encodeURIComponent(token)}`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Niet gevonden" }));
        throw new Error(err.error || "Niet gevonden");
      }
      const data2 = await res.json();
      setWo(data2);
    } catch (err: any) {
      setError(err.message || "Werkbon niet gevonden");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Poll every 30s for status updates
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !wo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center max-w-sm">
          <p className="text-lg font-bold text-gray-800 mb-2">Link niet geldig</p>
          <p className="text-sm text-gray-500">{error || "Deze werkbon-link is niet meer actief."}</p>
        </div>
      </div>
    );
  }

  const cfg = statusConfig[wo.status] || statusConfig.open;
  const StatusIcon = cfg.icon;
  const createdDate = new Date(wo.created_at).toLocaleDateString("nl-NL", {
    day: "numeric", month: "long", year: "numeric",
  });
  const completedDate = wo.completed_at
    ? new Date(wo.completed_at).toLocaleDateString("nl-NL", {
        day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : null;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Company header */}
        <div className="text-center mb-6">
          {wo.company_logo ? (
            <img src={wo.company_logo} alt={wo.company_name || ""} className="h-10 mx-auto mb-2 object-contain" />
          ) : wo.company_name ? (
            <h1 className="text-lg font-bold text-gray-900">{wo.company_name}</h1>
          ) : null}
        </div>

        {/* Status card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Status banner */}
          <div className={`${cfg.bg} px-6 py-5 flex items-center gap-3`}>
            <div className={`w-10 h-10 rounded-full ${cfg.bg} ${cfg.text} flex items-center justify-center`}>
              <StatusIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Status</p>
              <p className={`text-lg font-bold ${cfg.text}`}>{cfg.label}</p>
            </div>
          </div>

          {/* Details */}
          <div className="px-6 py-5 space-y-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-0.5">Werkbon</p>
              <p className="text-sm font-bold text-gray-900 font-mono">{wo.work_order_number}</p>
            </div>

            {wo.service_name && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-0.5">Dienst</p>
                <p className="text-sm font-semibold text-gray-900">{wo.service_name}</p>
              </div>
            )}

            {wo.customer_name && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-0.5">Klant</p>
                <p className="text-sm font-semibold text-gray-900">{wo.customer_name}</p>
              </div>
            )}

            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-0.5">Aangemaakt</p>
              <p className="text-sm text-gray-700">{createdDate}</p>
            </div>

            {completedDate && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-0.5">Afgerond op</p>
                <p className="text-sm text-emerald-700 font-semibold">{completedDate}</p>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Deze pagina wordt automatisch bijgewerkt
        </p>
      </div>
    </div>
  );
};

export default WorkOrderStatusPage;
