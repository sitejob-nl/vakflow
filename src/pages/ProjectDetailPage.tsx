import { useState } from "react";
import { useParams } from "react-router-dom";
import { useProject, useProjectPhases, useProjectStats, useProjectWorkOrders, useProjectInvoices, useProjectAppointments, useUpdateProject, useDeleteProjectPhase, type ProjectPhase } from "@/hooks/useProjects";
import { useNavigation } from "@/hooks/useNavigation";
import { useIndustryConfig } from "@/hooks/useIndustryConfig";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import ProjectDialog from "@/components/ProjectDialog";
import ProjectPhaseDialog from "@/components/ProjectPhaseDialog";
import WorkOrderDialog from "@/components/WorkOrderDialog";
import InvoiceDialog from "@/components/InvoiceDialog";
import AppointmentDialog from "@/components/AppointmentDialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Plus, FileText, DollarSign, Calendar, Clock, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";

const statusConfig: Record<string, { label: string; className: string }> = {
  gepland: { label: "Gepland", className: "bg-cyan-muted text-cyan" },
  actief: { label: "Actief", className: "bg-success-muted text-success" },
  gepauzeerd: { label: "Gepauzeerd", className: "bg-warning-muted text-warning" },
  afgerond: { label: "Afgerond", className: "bg-muted text-muted-foreground" },
  geannuleerd: { label: "Geannuleerd", className: "bg-destructive-muted text-destructive" },
};

const ProjectDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { navigate } = useNavigation();
  const { labels } = useIndustryConfig();
  const { toast } = useToast();
  const { data: project, isLoading } = useProject(id);
  const { data: phases } = useProjectPhases(id);
  const { data: stats } = useProjectStats(id);
  const { data: workOrders } = useProjectWorkOrders(id);
  const { data: invoices } = useProjectInvoices(id);
  const { data: appointments } = useProjectAppointments(id);
  const updateProject = useUpdateProject();
  const deletePhase = useDeleteProjectPhase();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [phaseDialogOpen, setPhaseDialogOpen] = useState(false);
  const [editPhase, setEditPhase] = useState<ProjectPhase | null>(null);
  const [woDialogOpen, setWoDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!project) {
    return <div className="text-center py-12 text-muted-foreground">Project niet gevonden</div>;
  }

  const eur = (n: number) => `€ ${Number(n).toFixed(2)}`;
  const cfg = statusConfig[project.status] ?? statusConfig.gepland;
  const budgetPct = project.budget_amount > 0 ? Math.min(100, ((stats?.totalInvoiced ?? 0) / project.budget_amount) * 100) : 0;
  const totalHours = stats ? Math.round(stats.totalHoursMinutes / 60 * 10) / 10 : 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button onClick={() => navigate("projects")} className="flex items-center gap-1 text-[12px] text-muted-foreground font-semibold mb-2 hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Terug naar projecten
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-extrabold">{project.name}</h1>
            <span className={`inline-flex px-2.5 py-[3px] rounded-full text-[11px] font-bold ${cfg.className}`}>{cfg.label}</span>
          </div>
          <p className="text-[13px] text-muted-foreground mt-1">
            {project.project_number} · {(project.customers as any)?.name}
            {project.start_date && ` · Start: ${format(new Date(project.start_date), "dd-MM-yyyy")}`}
            {project.deadline && ` · Deadline: ${format(new Date(project.deadline), "dd-MM-yyyy")}`}
          </p>
          {project.description && <p className="text-[13px] mt-2 text-secondary-foreground">{project.description}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
            <Edit className="h-3.5 w-3.5 mr-1" /> Bewerken
          </Button>
          {project.status !== "actief" && (
            <Button size="sm" onClick={async () => {
              await updateProject.mutateAsync({ id: project.id, status: "actief" } as any);
              toast({ title: "Project geactiveerd" });
            }}>Activeren</Button>
          )}
          {project.status === "actief" && (
            <Button size="sm" variant="outline" onClick={async () => {
              await updateProject.mutateAsync({ id: project.id, status: "afgerond" } as any);
              toast({ title: "Project afgerond" });
            }}>Afronden</Button>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-[12px] text-muted-foreground font-semibold">Budget</CardTitle></CardHeader>
          <CardContent>
            <div className="text-[20px] font-extrabold">{eur(project.budget_amount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-[12px] text-muted-foreground font-semibold">Gefactureerd</CardTitle></CardHeader>
          <CardContent>
            <div className="text-[20px] font-extrabold">{eur(stats?.totalInvoiced ?? 0)}</div>
            {project.budget_amount > 0 && <Progress value={budgetPct} className="h-1.5 mt-2" />}
            <p className="text-[11px] text-muted-foreground mt-1">{budgetPct.toFixed(0)}% van budget</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-[12px] text-muted-foreground font-semibold">Betaald</CardTitle></CardHeader>
          <CardContent>
            <div className="text-[20px] font-extrabold">{eur(stats?.totalPaid ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-[12px] text-muted-foreground font-semibold">Uren</CardTitle></CardHeader>
          <CardContent>
            <div className="text-[20px] font-extrabold">{totalHours} uur</div>
            <p className="text-[11px] text-muted-foreground mt-1">{stats?.completedWorkOrders ?? 0}/{stats?.workOrderCount ?? 0} {labels.workOrders.toLowerCase()} afgerond</p>
          </CardContent>
        </Card>
      </div>

      {/* Phases */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-bold">Fases</h2>
          <Button variant="outline" size="sm" onClick={() => { setEditPhase(null); setPhaseDialogOpen(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Fase toevoegen
          </Button>
        </div>
        {phases && phases.length > 0 ? (
          <Accordion type="multiple" className="space-y-2">
            {phases.map((phase) => {
              const phaseCfg = statusConfig[phase.status] ?? statusConfig.gepland;
              return (
                <AccordionItem key={phase.id} value={phase.id} className="bg-card border border-border rounded-lg px-4">
                  <AccordionTrigger className="text-[13px] font-semibold hover:no-underline">
                    <div className="flex items-center gap-2">
                      <span>{phase.name}</span>
                      <span className={`inline-flex px-2 py-[2px] rounded-full text-[10px] font-bold ${phaseCfg.className}`}>{phaseCfg.label}</span>
                      {phase.budget_amount > 0 && <span className="text-[11px] text-muted-foreground font-mono">{eur(phase.budget_amount)}</span>}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-[13px] text-secondary-foreground">
                    {phase.description && <p className="mb-2">{phase.description}</p>}
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => { setEditPhase(phase); setPhaseDialogOpen(true); }}>
                        <Edit className="h-3 w-3 mr-1" /> Bewerken
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-[11px] text-destructive" onClick={() => deletePhase.mutateAsync(phase.id)}>
                        <Trash2 className="h-3 w-3 mr-1" /> Verwijderen
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        ) : (
          <p className="text-[13px] text-muted-foreground">Geen fases gedefinieerd. Voeg fases toe om het project op te delen.</p>
        )}
      </div>

      {/* Work Orders */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-bold">{labels.workOrders}</h2>
          <Button variant="outline" size="sm" onClick={() => setWoDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Nieuwe {labels.workOrder.toLowerCase()}
          </Button>
        </div>
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {!workOrders?.length ? (
            <p className="text-[13px] text-muted-foreground px-4 py-6 text-center">Nog geen {labels.workOrders.toLowerCase()}</p>
          ) : (
            <div className="divide-y divide-border">
              {workOrders.map((wo) => (
                <div
                  key={wo.id}
                  className="px-4 py-3 flex items-center justify-between hover:bg-bg-hover transition-colors cursor-pointer"
                  onClick={() => navigate("woDetail", { workOrderId: wo.id })}
                >
                  <div>
                    <span className="text-[13px] font-semibold">{wo.work_order_number}</span>
                    <span className="text-[12px] text-muted-foreground ml-2">{wo.description?.slice(0, 60)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-mono text-muted-foreground">{wo.total_amount ? eur(wo.total_amount) : ""}</span>
                    <span className={`inline-flex px-2 py-[2px] rounded-full text-[10px] font-bold ${(statusConfig[wo.status] ?? statusConfig.gepland).className}`}>
                      {wo.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Invoices */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-bold">Facturen</h2>
          <Button variant="outline" size="sm" onClick={() => setInvoiceDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Nieuwe factuur
          </Button>
        </div>
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {!invoices?.length ? (
            <p className="text-[13px] text-muted-foreground px-4 py-6 text-center">Nog geen facturen</p>
          ) : (
            <div className="divide-y divide-border">
              {invoices.map((inv, idx) => (
                <div key={inv.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <span className="text-[13px] font-semibold">{inv.invoice_number ?? `Factuur ${idx + 1}`}</span>
                    <span className="text-[12px] text-muted-foreground ml-2">
                      {inv.created_at ? format(new Date(inv.created_at), "dd-MM-yyyy") : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-mono font-semibold">{eur(inv.total)}</span>
                    <span className={`inline-flex px-2 py-[2px] rounded-full text-[10px] font-bold ${(statusConfig[inv.status] ?? statusConfig.gepland).className}`}>
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Appointments */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-bold">Afspraken</h2>
          <Button variant="outline" size="sm" onClick={() => setAppointmentDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Nieuwe afspraak
          </Button>
        </div>
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {!appointments?.length ? (
            <p className="text-[13px] text-muted-foreground px-4 py-6 text-center">Nog geen afspraken</p>
          ) : (
            <div className="divide-y divide-border">
              {appointments.map((apt) => (
                <div key={apt.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <span className="text-[13px] font-semibold">
                      {format(new Date(apt.scheduled_at), "dd-MM-yyyy HH:mm")}
                    </span>
                    <span className="text-[12px] text-muted-foreground ml-2">{apt.duration_minutes} min</span>
                  </div>
                  <span className={`inline-flex px-2 py-[2px] rounded-full text-[10px] font-bold ${(statusConfig[apt.status] ?? statusConfig.gepland).className}`}>
                    {apt.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <ProjectDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} editProject={project} />
      <ProjectPhaseDialog open={phaseDialogOpen} onOpenChange={setPhaseDialogOpen} projectId={project.id} editPhase={editPhase} nextSortOrder={(phases?.length ?? 0)} />
      <WorkOrderDialog open={woDialogOpen} onOpenChange={setWoDialogOpen} projectId={project.id} />
      <InvoiceDialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen} projectId={project.id} />
      <AppointmentDialog open={appointmentDialogOpen} onOpenChange={setAppointmentDialogOpen} prefill={{ customer_id: project.customer_id }} projectId={project.id} />
    </div>
  );
};

export default ProjectDetailPage;
