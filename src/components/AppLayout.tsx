import { Outlet } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import MobileNav from "@/components/MobileNav";
import OnboardingDialog from "@/components/OnboardingDialog";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import { useNavigation } from "@/hooks/useNavigation";

const AppLayout = () => {
  const { currentPage } = useNavigation();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden bg-background min-w-0">
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
