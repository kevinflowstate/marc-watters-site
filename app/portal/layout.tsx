import Sidebar from "@/components/portal/Sidebar";
import PushNotificationBanner from "@/components/portal/PushNotificationBanner";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata = {
  title: "Client Portal - Marc Watters",
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-bg-primary">
        <Sidebar />
        <main className="lg:ml-[260px] min-h-screen">
          <div className="max-w-6xl mx-auto px-6 py-8">
            <PushNotificationBanner />
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
