import { useState } from "react";
import { useTodos, useCreateTodo, useToggleTodo, useDeleteTodo } from "@/hooks/useTodos";
import { useCustomers } from "@/hooks/useCustomers";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Loader2, Plus, Trash2, CalendarIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const TodoWidget = () => {
  const { data: todos, isLoading } = useTodos();
  const { data: customers } = useCustomers();
  const createTodo = useCreateTodo();
  const toggleTodo = useToggleTodo();
  const deleteTodo = useDeleteTodo();

  const [title, setTitle] = useState("");
  const [customerId, setCustomerId] = useState<string>("none");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [showForm, setShowForm] = useState(false);

  const handleAdd = () => {
    if (!title.trim()) return;
    createTodo.mutate(
      {
        title: title.trim(),
        customer_id: customerId !== "none" ? customerId : null,
        due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
      },
      {
        onSuccess: () => {
          setTitle("");
          setCustomerId("none");
          setDueDate(undefined);
          setShowForm(false);
        },
      }
    );
  };

  const openCount = todos?.filter((t) => !t.completed).length ?? 0;

  return (
    <div className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
      <div className="px-4 md:px-5 py-3 md:py-4 flex items-center justify-between border-b border-border">
        <h3 className="text-[14px] md:text-[15px] font-bold">To-do's</h3>
        <div className="flex items-center gap-2">
          {openCount > 0 && (
            <span className="inline-flex px-2.5 py-[3px] rounded-full text-[11px] font-bold bg-primary-muted text-primary">
              {openCount} open
            </span>
          )}
          <button
            onClick={() => setShowForm(!showForm)}
            className="p-1.5 bg-card border border-border rounded-sm text-secondary-foreground hover:bg-bg-hover transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {showForm && (
        <div className="px-4 md:px-5 py-3 border-b border-border space-y-2">
          <Input
            placeholder="Wat moet er gebeuren?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="text-[13px]"
            autoFocus
          />
          <div className="flex gap-2 flex-wrap">
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="w-[180px] h-8 text-[12px]">
                <SelectValue placeholder="Klant (optioneel)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Geen klant</SelectItem>
                {customers?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("h-8 text-[12px] gap-1.5", !dueDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dueDate ? format(dueDate, "d MMM", { locale: nl }) : "Datum"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <Button size="sm" className="h-8 text-[12px]" onClick={handleAdd} disabled={!title.trim() || createTodo.isPending}>
              {createTodo.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Toevoegen"}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !todos?.length ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Geen to-do's</div>
      ) : (
        <div className="divide-y divide-border max-h-[320px] overflow-y-auto">
          {todos.map((todo) => (
            <div
              key={todo.id}
              className={cn(
                "px-4 md:px-5 py-2.5 flex items-start gap-3 group hover:bg-bg-hover transition-colors",
                todo.completed && "opacity-50"
              )}
            >
              <Checkbox
                checked={todo.completed}
                onCheckedChange={(checked) =>
                  toggleTodo.mutate({ id: todo.id, completed: !!checked })
                }
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className={cn("text-[13px] font-medium", todo.completed && "line-through")}>
                  {todo.title}
                </div>
                <div className="flex gap-2 mt-0.5 flex-wrap">
                  {todo.customers?.name && (
                    <span className="text-[10.5px] text-secondary-foreground">{todo.customers.name}</span>
                  )}
                  {todo.due_date && (
                    <span className="text-[10.5px] text-secondary-foreground font-mono">
                      {format(new Date(todo.due_date + "T00:00:00"), "d MMM", { locale: nl })}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => deleteTodo.mutate(todo.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TodoWidget;
