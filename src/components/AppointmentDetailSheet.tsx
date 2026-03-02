import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  Clock, MapPin, User, Wrench, Navigation, ExternalLink,
  Pencil, Trash2, CheckCircle2, Plus, X, Loader2, FileText, Copy,
} from "lucide-react";
import { useUpdateAppointment, type Appointment } from "@/hooks/useAppointments";
import { useCreateWorkOrder } from "@/hooks/useWorkOrders";
import { useServices } from "@/hooks/useCustomers";
import { buildWorkOrderPayload } from "@/utils/createWorkOrderFromAppointment";
import { useNavigation } from "@/hooks/useNavigation";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
  onEdit: (appointment: Appointment) => void;
  onDelete: (appointment: Appointment) => void;
  onFinish: (appointment: Appointment) => void;
  onDuplicate?: (appointment: Appointment) => void;
  linkedWorkOrderId?: string | null;
}

const statusLabels: Record<string, string> = {
  gepland: "Gepland",
  onderweg: "Onderweg",
  bezig: "Bezig",
  afgerond: "Afgerond",
  geannuleerd: "Geannuleerd",
};

const statusColors: Record<string, string> = {
  gepland: "bg-muted text-muted-foreground",
  onderweg: "bg-warning/15 text-warning",
  bezig: "bg-primary/15 text-primary",
  afgerond: "bg-accent/15 text-accent",
  geannuleerd: "bg-destructive/15 text-destructive",
};

const AppointmentDetailSheet = ({ open, onOpenChange, appointment, onEdit, onDelete, onFinish, onDuplicate, linkedWorkOrderId }: Props) => {
  const { toast } = useToast();
  const { navigate } = useNavigation();
  const updateAppointment = useUpdateAppointment();
  const createWorkOrder = useCreateWorkOrder();
  const { data: services } = useServices();
  const [newTodo, setNewTodo] = useState("");
  const [newNote, setNewNote] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [creatingWO, setCreatingWO] = useState(false);
  const isMobile = useIsMobile();

  const handleCreateWorkOrder = async () => {
    if (!appointment) return;
    setCreatingWO(true);
    try {
      const payload = buildWorkOrderPayload(appointment, services);
      const wo = await createWorkOrder.mutateAsync(payload as any);
      toast({ title: "Werkbon aangemaakt", description: wo.work_order_number ?? "Werkbon is klaar" });
      onOpenChange(false);
      navigate("woDetail", { workOrderId: wo.id });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
    setCreatingWO(false);
  };

  if (!appointment) return null;

  const a = appointment;
  const scheduled = new Date(a.scheduled_at);
  const endTime = new Date(scheduled.getTime() + (a.duration_minutes ?? 60) * 60000);
  const todos: TodoItem[] = Array.isArray((a as any).todos) ? (a as any).todos : [];
  const travelMin = (a as any).travel_time_minutes;
  const startLabel = (a as any).start_location_label;

  const handleToggleTodo = async (todoId: string) => {
    const updatedTodos = todos.map((t) =>
      t.id === todoId ? { ...t, done: !t.done } : t
    );
    try {
      await updateAppointment.mutateAsync({
        id: a.id,
        todos: updatedTodos as any,
      });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const handleAddTodo = async () => {
    if (!newTodo.trim()) return;
    const updatedTodos = [...todos, { id: crypto.randomUUID(), text: newTodo.trim(), done: false }];
    try {
      await updateAppointment.mutateAsync({
        id: a.id,
        todos: updatedTodos as any,
      });
      setNewTodo("");
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const handleRemoveTodo = async (todoId: string) => {
    const updatedTodos = todos.filter((t) => t.id !== todoId);
    try {
      await updateAppointment.mutateAsync({
        id: a.id,
        todos: updatedTodos as any,
      });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await updateAppointment.mutateAsync({
        id: a.id,
        notes: newNote || a.notes || null,
      });
      toast({ title: "Notities opgeslagen" });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
    setSavingNotes(false);
  };

  const mapsUrl = a.customers?.address && a.customers?.city
    ? `https://www.google.com/maps/place/${`${a.customers.address}, ${a.customers.postal_code || ""} ${a.customers.city}`.replace(/ /g, "+")}`
    : null;

  const detailContent = (
    <div className="space-y-5 px-4 pb-6">
      {/* Status badge */}
      <div className="flex items-center gap-2">
        <span className={`px-3 py-1 rounded-full text-[12px] font-bold ${statusColors[a.status] ?? statusColors.gepland}`}>
          {statusLabels[a.status] ?? a.status}
        </span>
        {a.services && (
          <span className="text-[12px] text-muted-foreground">{a.services.name} · €{a.services.price}</span>
        )}
      </div>

      {/* Time & date */}
      <div className="flex items-center gap-3 text-[13px]">
        <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div>
          <div className="font-bold">
            {format(scheduled, "EEEE d MMMM yyyy", { locale: nl })}
          </div>
          <div className="text-muted-foreground">
            {format(scheduled, "HH:mm")} – {format(endTime, "HH:mm")} ({a.duration_minutes} min)
          </div>
        </div>
      </div>

      {/* Customer & address */}
      <div className="flex items-start gap-3 text-[13px]">
        <User className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-bold">{a.customers?.name}</div>
          {a.customers?.address && (
            <div className="text-muted-foreground">
              {a.customers.address}, {a.customers.postal_code} {a.customers.city}
            </div>
          )}
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 text-[12px] font-medium inline-flex items-center gap-1 mt-1"
            >
              <ExternalLink className="h-3 w-3" /> Route
            </a>
          )}
        </div>
      </div>

      {/* Linked address */}
      {a.address_id && (a as any).addresses && (() => {
        const addr = (a as any).addresses;
        const addrLine = [addr.street, addr.house_number].filter(Boolean).join(" ");
        const addrLine2 = [addr.postal_code, addr.city].filter(Boolean).join(" ");
        const addrFull = [addrLine, addrLine2].filter(Boolean).join(", ");
        const addrMapsUrl = addrFull
          ? `https://www.google.com/maps/place/${addrFull.replace(/ /g, "+")}`
          : null;
        return (
          <div className="flex items-start gap-3 text-[13px]">
            <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-bold">
                {addrLine}
                {addr.apartment && <span className="text-muted-foreground font-normal ml-1">({addr.apartment})</span>}
              </div>
              {addrLine2 && <div className="text-muted-foreground">{addrLine2}</div>}
              {addr.notes && <div className="text-[12px] text-muted-foreground mt-0.5 italic">{addr.notes}</div>}
              {addrMapsUrl && (
                <a
                  href={addrMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80 text-[12px] font-medium inline-flex items-center gap-1 mt-1"
                >
                  <ExternalLink className="h-3 w-3" /> Route naar adres
                </a>
              )}
            </div>
          </div>
        );
      })()}
      {travelMin > 0 && (
        <div className="flex items-center gap-3 text-[13px]">
          <Navigation className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span>
            <strong>{travelMin} min</strong>
            {startLabel && <span className="text-muted-foreground ml-1">vanaf {startLabel}</span>}
          </span>
        </div>
      )}

      {/* Notes */}
      <div className="border-t border-border pt-4">
        <h4 className="text-[13px] font-bold mb-2 flex items-center gap-1.5">
          <Pencil className="h-3.5 w-3.5" /> Opmerkingen
        </h4>
        <Textarea
          defaultValue={a.notes || ""}
          onChange={(e) => setNewNote(e.target.value)}
          rows={3}
          placeholder="Voeg opmerkingen toe..."
          className="text-[13px]"
        />
        <Button
          size="sm"
          variant="outline"
          className="mt-2 text-[12px] h-8"
          onClick={handleSaveNotes}
          disabled={savingNotes}
        >
          {savingNotes && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
          Opmerking opslaan
        </Button>
      </div>

      {/* To-do list */}
      <div className="border-t border-border pt-4">
        <h4 className="text-[13px] font-bold mb-2 flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" /> To-do's
        </h4>
        <div className="space-y-1.5">
          {todos.map((todo) => (
            <div key={todo.id} className="flex items-center gap-2 group">
              <Checkbox
                checked={todo.done}
                onCheckedChange={() => handleToggleTodo(todo.id)}
              />
              <span className={`text-[13px] flex-1 ${todo.done ? "line-through text-muted-foreground" : ""}`}>
                {todo.text}
              </span>
              <button
                onClick={() => handleRemoveTodo(todo.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-0.5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <Input
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            placeholder="Nieuwe to-do..."
            className="text-[13px] h-8"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTodo())}
          />
          <Button size="sm" variant="outline" className="h-8 px-2" onClick={handleAddTodo}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-border pt-4 flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          className="text-[12px]"
          onClick={() => { onOpenChange(false); onEdit(a); }}
        >
          <Pencil className="h-3.5 w-3.5 mr-1" /> Bewerken
        </Button>
        {onDuplicate && (
          <Button
            variant="outline"
            size="sm"
            className="text-[12px]"
            onClick={() => { onOpenChange(false); onDuplicate(a); }}
          >
            <Copy className="h-3.5 w-3.5 mr-1" /> Kopiëren
          </Button>
        )}
        {linkedWorkOrderId ? (
          <Button
            variant="outline"
            size="sm"
            className="text-[12px]"
            onClick={() => { onOpenChange(false); navigate("woDetail", { workOrderId: linkedWorkOrderId }); }}
          >
            <FileText className="h-3.5 w-3.5 mr-1" /> Bekijk werkbon
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              className="text-[12px]"
              onClick={handleCreateWorkOrder}
              disabled={creatingWO}
            >
              {creatingWO ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <FileText className="h-3.5 w-3.5 mr-1" />}
              Werkbon aanmaken
            </Button>
            {a.status !== "afgerond" && a.status !== "geannuleerd" && (
              <Button
                variant="outline"
                size="sm"
                className="text-[12px] text-accent border-accent/30 hover:bg-accent/10"
                onClick={() => { onOpenChange(false); onFinish(a); }}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Afronden → Werkbon
              </Button>
            )}
          </>
        )}
        <Button
          variant="outline"
          size="sm"
          className="text-[12px] text-destructive border-destructive/30 hover:bg-destructive/10 ml-auto"
          onClick={() => { onOpenChange(false); onDelete(a); }}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" /> Verwijderen
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-lg">{a.customers?.name ?? "Afspraak"}</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto flex-1">
            {detailContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-lg">{a.customers?.name ?? "Afspraak"}</SheetTitle>
        </SheetHeader>
        {detailContent}
      </SheetContent>
    </Sheet>
  );
};

export default AppointmentDetailSheet;
