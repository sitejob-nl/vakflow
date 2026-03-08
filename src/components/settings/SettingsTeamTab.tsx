import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { SETTINGS_INPUT_CLASS as inputClass, SETTINGS_LABEL_CLASS as labelClass } from "./shared";

const SettingsTeamTab = () => {
  const { user, maxUsers } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<any[]>([]);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("monteur");
  const [inviting, setInviting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadMembers = async () => {
    setLoading(true);
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: true }),
      supabase.from("user_roles").select("*"),
    ]);
    setMembers(profilesRes.data ?? []);
    const roleMap: Record<string, string> = {};
    (rolesRes.data ?? []).forEach((r: any) => { roleMap[r.user_id] = r.role; });
    setRoles(roleMap);
    setLoading(false);
  };

  useEffect(() => { loadMembers(); }, []);

  const handleInvite = async () => {
    if (!inviteEmail) return;
    if (members.length >= maxUsers) { toast({ title: "Gebruikerslimiet bereikt", description: `Max ${maxUsers} gebruikers.`, variant: "destructive" }); return; }
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: { email: inviteEmail, full_name: inviteName || undefined, redirect_url: window.location.origin + "/auth", role: inviteRole },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Uitnodiging verstuurd", description: `E-mail verstuurd naar ${inviteEmail}` });
      setInviteEmail(""); setInviteName(""); setInviteRole("monteur");
      loadMembers();
    } catch (err: any) { toast({ title: "Uitnodiging mislukt", description: err.message, variant: "destructive" }); }
    setInviting(false);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-user", { body: { action: "delete", user_id: deletingId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Teamlid verwijderd" });
      setDeletingId(null);
      loadMembers();
    } catch (err: any) { toast({ title: "Fout", description: err.message, variant: "destructive" }); }
    setDeleting(false);
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      const { data: p } = await supabase.from("profiles").select("company_id").eq("id", user!.id).single();
      if (!p?.company_id) throw new Error("Geen bedrijf gevonden");
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("company_id", p.company_id);
      await supabase.from("user_roles").insert({ user_id: userId, company_id: p.company_id, role: newRole } as any);
      setRoles((prev) => ({ ...prev, [userId]: newRole }));
      toast({ title: "Rol bijgewerkt" });
    } catch (err: any) { toast({ title: "Fout", description: err.message, variant: "destructive" }); }
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6 space-y-5">
      <div>
        <h3 className="text-[14px] font-bold mb-1">Teamleden</h3>
        <p className="text-[12px] text-secondary-foreground mb-3">Beheer wie toegang heeft tot het systeem. ({members.length}/{maxUsers} gebruikers)</p>
      </div>
      <div className="border border-border rounded-md p-4 space-y-3">
        <h4 className="text-[13px] font-bold flex items-center gap-1.5"><UserPlus className="h-4 w-4" /> Teamlid uitnodigen</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className={labelClass}>E-mailadres *</label><input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className={inputClass} placeholder="naam@bedrijf.nl" /></div>
          <div><label className={labelClass}>Naam (optioneel)</label><input value={inviteName} onChange={(e) => setInviteName(e.target.value)} className={inputClass} placeholder="Volledige naam" /></div>
        </div>
        <div><label className={labelClass}>Rol</label>
          <Select value={inviteRole} onValueChange={setInviteRole}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="monteur">Monteur / Medewerker</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleInvite} disabled={inviting || !inviteEmail}>{inviting ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Uitnodigen...</> : "Uitnodigen"}</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Naam</TableHead><TableHead>E-mail</TableHead><TableHead>Rol</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.full_name || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{m.email || "—"}</TableCell>
                <TableCell>
                  {m.id === user?.id ? (
                    <span className="text-[12px] font-bold text-primary">{roles[m.id] || "admin"}</span>
                  ) : (
                    <Select value={roles[m.id] || "monteur"} onValueChange={(v) => handleChangeRole(m.id, v)}>
                      <SelectTrigger className="w-[130px] h-8 text-[12px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="monteur">Monteur</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
                <TableCell>
                  {m.id !== user?.id && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeletingId(m.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Teamlid verwijderen?</AlertDialogTitle><AlertDialogDescription>Dit verwijdert het account permanent.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deleting ? "Verwijderen..." : "Verwijderen"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SettingsTeamTab;
