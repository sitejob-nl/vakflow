import { forwardRef } from "react";
import { useNavigation, type Page } from "@/hooks/useNavigation";
import { LayoutGrid, Calendar, Users, FileText, DollarSign, Mail, MessageSquare } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const allItems = [
  { id: "dashboard" as Page, icon: LayoutGrid, label: "Home", adminOnly: true },
  { id: "planning" as Page, icon: Calendar, label: "Planning", adminOnly: false },
  { id: "workorders" as Page, icon: FileText, label: "Bonnen", adminOnly: false },
  { id: "email" as Page, icon: Mail, label: "E-mail", adminOnly: true },
  { id: "whatsapp" as Page, icon: MessageSquare, label: "WhatsApp", adminOnly: true },
];

const MobileNav = forwardRef<HTMLElement>((_props, ref) => {
  const { currentPage, navigate } = useNavigation();
  const { isAdmin } = useAuth();

  const items = allItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <nav ref={ref} className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border safe-bottom">
      <div className="flex items-center justify-around h-[60px] px-1">
        {items.map((item) => {
          const active = currentPage === item.id ||
            (item.id === "customers" && currentPage === "custDetail") ||
            (item.id === "workorders" && currentPage === "woDetail");
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-[56px] ${
                active ? "text-primary" : "text-t3"
              }`}
            >
              <item.icon className="w-5 h-5" strokeWidth={active ? 2.2 : 1.8} />
              <span className="text-[10px] font-semibold">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
});

MobileNav.displayName = "MobileNav";

export default MobileNav;
