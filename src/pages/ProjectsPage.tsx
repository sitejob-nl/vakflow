import { useState, useMemo } from "react";
import { useProjects, useDeleteProject, type Project } from "@/hooks/useProjects";
import { useNavigation } from "@/hooks/useNavigation";
import { Button } from "@/components/ui/button";
import ProjectDialog from "@/components/ProjectDialog";
import { Loader2, Plus, Trash2, FolderKanban } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const tabs = ["Alle", "Actief", "Afgerond"];

const statusConfig: Record<string, { label: string; className: string }> = {
  gepland: { label: "Gepland", className: "bg-cyan-muted text-cyan" },
  actief: { label: "Actief", className: "bg-success-muted text-success" },
  gepauzeerd: { label: "Gepauzeerd", className: "bg-warning-muted text-warning" },
  afgerond: { label: "Afgerond", className: "bg-muted text-muted-foreground" },
  geannuleerd: { label: "Geannuleerd", className: "bg-destructive-muted text-destructive" },
};

const ProjectsPage = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const { data: projects, isLoading } = useProjects();
  const deleteProject = useDeleteProject();
  const { navigate } = useNavigation();
  const { toast } = useToast();

  const filtered = useMemo(() => {
    if (!projects) return [];
    if (activeTab === 1) return projects.filter((p) => p.status === "actief" || p.status === "gepland");
    if (activeTab === 2) return projects.filter((p) => p.status === "afgerond");
    return projects;
  }, [projects, activeTab]);

  const eur = (n: number) => `€ ${Number(n).toFixed(2)}`;

  const handleDelete = async (id: string) => {
    try {
      await deleteProject.mutateAsync(id);
      toast({ title: "Project verwijderd" });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-0 border-b-2 border-border overflow-x-auto scrollbar-hide">
          {tabs.map((t, i) => (
            <button key={t} onClick={() => setActiveTab(i)} className={`px-4 md:px-5 py-2.5 text-[12px] md:text-[13px] font-bold border-b-2 -mb-[2px] transition-colors whitespace-nowrap ${i === activeTab ? "text-primary border-primary" : "text-t3 border-transparent hover:text-secondary-foreground"}`}>
              {t}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => { setEditProject(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nieuw project
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-[15px] font-bold">Projecten</h3>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : !filtered.length ? (
          <div className="text-center py-12 text-muted-foreground">
            <FolderKanban className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Geen projecten gevonden</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => { setEditProject(null); setDialogOpen(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Eerste project aanmaken
            </Button>
          </div>
        ) : (
          <>
          {/* Desktop table */}
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 font-bold text-muted-foreground text-[11px] uppercase">Nummer</th>
                  <th className="text-left px-4 py-2.5 font-bold text-muted-foreground text-[11px] uppercase">Naam</th>
                  <th className="text-left px-4 py-2.5 font-bold text-muted-foreground text-[11px] uppercase">Klant</th>
                  <th className="text-left px-4 py-2.5 font-bold text-muted-foreground text-[11px] uppercase">Status</th>
                  <th className="text-right px-4 py-2.5 font-bold text-muted-foreground text-[11px] uppercase">Budget</th>
                  <th className="text-left px-4 py-2.5 font-bold text-muted-foreground text-[11px] uppercase">Start</th>
                  <th className="text-right px-4 py-2.5 font-bold text-muted-foreground text-[11px] uppercase"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const cfg = statusConfig[p.status] ?? statusConfig.gepland;
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-border/50 hover:bg-bg-hover transition-colors cursor-pointer"
                      onClick={() => navigate("projDetail", { projectId: p.id })}
                    >
                      <td className="px-4 py-3 font-mono text-[12px] text-muted-foreground">{p.project_number ?? "—"}</td>
                      <td className="px-4 py-3 font-semibold">{p.name}</td>
                      <td className="px-4 py-3">{(p.customers as any)?.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-[3px] rounded-full text-[11px] font-bold ${cfg.className}`}>{cfg.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{p.budget_amount ? eur(p.budget_amount) : "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.start_date ? format(new Date(p.start_date), "dd-MM-yyyy") : "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden divide-y divide-border">
            {filtered.map((p) => {
              const cfg = statusConfig[p.status] ?? statusConfig.gepland;
              return (
                <div
                  key={p.id}
                  onClick={() => navigate("projDetail", { projectId: p.id })}
                  className="px-4 py-3 flex items-center gap-3 active:bg-muted/50 transition-colors cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FolderKanban className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold truncate">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {(p.customers as any)?.name ?? "—"}
                      {p.budget_amount ? ` · ${eur(p.budget_amount)}` : ""}
                    </div>
                  </div>
                  <span className={`inline-flex px-2 py-[2px] rounded-full text-[10px] font-bold flex-shrink-0 ${cfg.className}`}>{cfg.label}</span>
                </div>
              );
            })}
          </div>
          </>
        )}
      </div>

      <ProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} editProject={editProject} />
    </div>
  );
};

export default ProjectsPage;
