import { Outlet } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import MobileNav from "@/components/MobileNav";
import OnboardingDialog from "@/components/OnboardingDialog";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import OfflineBanner from "@/components/OfflineBanner";
import { useNavigation } from "@/hooks/useNavigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useEffect } from "react";

/** Convert hex color (#4F46E5) to HSL string like "237 84% 58%" */
function hexToHsl(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hue = 0, sat = 0;
  const lig = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    sat = lig > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) hue = ((b - r) / d + 2) / 6;
    else hue = ((r - g) / d + 4) / 6;
  }

  return `${Math.round(hue * 360)} ${Math.round(sat * 100)}% ${Math.round(lig * 100)}%`;
}

/** Darken an HSL string by reducing lightness */
function darkenHsl(hsl: string, amount: number): string {
  const parts = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
  if (!parts) return hsl;
  const l = Math.max(0, parseInt(parts[3]) - amount);
  return `${parts[1]} ${parts[2]}% ${l}%`;
}

const AppLayout = () => {
  const { currentPage } = useNavigation();
  const { companyBrandColor } = useAuth();
  const { tenant, isTenantSite } = useTenant();

  // Tenant brand color takes priority over company brand color
  const activeBrandColor = (isTenantSite && tenant?.brand_color) ? tenant.brand_color : companyBrandColor;

  useEffect(() => {
    const root = document.documentElement;
    if (activeBrandColor && /^#[0-9a-fA-F]{6}$/.test(activeBrandColor)) {
      const hsl = hexToHsl(activeBrandColor);
      const hslHover = darkenHsl(hsl, 8);
      root.style.setProperty("--primary", hsl);
      root.style.setProperty("--primary-hover", hslHover);
      root.style.setProperty("--primary-muted", `${hsl} / 0.10`);
      root.style.setProperty("--ring", hsl);
      root.style.setProperty("--sidebar-primary", hsl);
      root.style.setProperty("--sidebar-ring", hsl);
      // Extract hue for bg-hover
      const hue = hsl.split(" ")[0];
      root.style.setProperty("--bg-hover", `${hue} 50% 97%`);
      root.style.setProperty("--bg-active", `${hue} 50% 94%`);
    } else {
      // Reset to defaults
      root.style.removeProperty("--primary");
      root.style.removeProperty("--primary-hover");
      root.style.removeProperty("--primary-muted");
      root.style.removeProperty("--ring");
      root.style.removeProperty("--sidebar-primary");
      root.style.removeProperty("--sidebar-ring");
      root.style.removeProperty("--bg-hover");
      root.style.removeProperty("--bg-active");
    }
    return () => {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--primary-hover");
      root.style.removeProperty("--primary-muted");
      root.style.removeProperty("--ring");
      root.style.removeProperty("--sidebar-primary");
      root.style.removeProperty("--sidebar-ring");
      root.style.removeProperty("--bg-hover");
      root.style.removeProperty("--bg-active");
    };
  }, [activeBrandColor]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden bg-background min-w-0">
        <OfflineBanner />
        <ImpersonationBanner />
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-5 lg:p-6 pb-[calc(80px+env(safe-area-inset-bottom,0px))] lg:pb-6 animate-page-in" key={currentPage}>
          <Outlet />
        </main>
      </div>
      <MobileNav />
      <OnboardingDialog />
    </div>
  );
};

export default AppLayout;