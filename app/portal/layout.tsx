import Sidebar from "@/components/portal/Sidebar";
import MobileNav from "@/components/portal/MobileNav";
import PushNotificationBanner from "@/components/portal/PushNotificationBanner";
import { ToastProvider } from "@/components/ui/Toast";
import Splash from "@/components/Splash";

export const metadata = {
  title: "Client Portal - Marc Watters",
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <Splash />
      <div className="min-h-screen bg-bg-primary">
        <Sidebar />
        <main className="lg:ml-[260px] min-h-screen pb-16 lg:pb-0">
          <div className="max-w-6xl mx-auto px-6 py-8">
            <PushNotificationBanner />
            {children}
          </div>
        </main>
        <MobileNav />
      </div>
    </ToastProvider>
  );
}
