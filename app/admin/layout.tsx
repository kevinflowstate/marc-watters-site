import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminMobileNav from "@/components/admin/AdminMobileNav";
import AdminBackground from "@/components/admin/AdminBackground";
import PushNotificationBanner from "@/components/portal/PushNotificationBanner";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata = {
  title: "Admin - Marc Watters",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="portal-v2-shell min-h-screen bg-bg-primary relative">
        <AdminBackground />
        <AdminSidebar />
        <main className="lg:ml-[260px] min-h-screen relative z-[1]">
          <div className="portal-v2-content px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
            <PushNotificationBanner />
            {children}
          </div>
        </main>
        <AdminMobileNav />
      </div>
    </ToastProvider>
  );
}
