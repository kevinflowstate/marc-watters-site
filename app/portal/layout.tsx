import Sidebar from "@/components/portal/Sidebar";
import MobileNav from "@/components/portal/MobileNav";
import PushNotificationBanner from "@/components/portal/PushNotificationBanner";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata = {
  title: "Client Portal - Marc Watters",
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="portal-v2-shell min-h-screen bg-bg-primary">
        <Sidebar />
        <main className="lg:ml-[260px] min-h-screen">
          <div className="portal-v2-content px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
            <PushNotificationBanner />
            {children}
          </div>
        </main>
        <MobileNav />
      </div>
    </ToastProvider>
  );
}
