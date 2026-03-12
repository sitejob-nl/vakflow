import { Building2, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useCompanySwitcher } from "@/hooks/useCompanySwitcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/components/ui/sidebar";

const CompanySwitcher = () => {
  const { companies, activeCompany, switchCompany, hasMultipleCompanies, isLoading, isSwitching } = useCompanySwitcher();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  if (isLoading || !hasMultipleCompanies) return null;

  return (
    <div className="px-2 py-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            disabled={isSwitching}
            className={`w-full flex items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/50 px-2.5 py-2 text-left transition-colors hover:bg-sidebar-accent ${collapsed ? "justify-center px-1.5" : ""}`}
          >
            {isSwitching ? (
              <Loader2 className="h-4 w-4 animate-spin text-sidebar-foreground/70 shrink-0" />
            ) : (
              <Building2 className="h-4 w-4 text-sidebar-foreground/70 shrink-0" />
            )}
            {!collapsed && (
              <>
                <span className="flex-1 truncate text-[12.5px] font-semibold text-sidebar-foreground">
                  {activeCompany?.company_name ?? "Bedrijf"}
                </span>
                <ChevronsUpDown className="h-3.5 w-3.5 text-sidebar-foreground/50 shrink-0" />
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side={collapsed ? "right" : "bottom"} className="w-56">
          {companies.map((c) => (
            <DropdownMenuItem
              key={c.company_id}
              onClick={() => switchCompany(c.company_id)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate text-[13px] font-medium">{c.company_name}</span>
              {c.is_active && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default CompanySwitcher;
