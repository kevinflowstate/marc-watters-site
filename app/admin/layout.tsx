import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminMobileNav from "@/components/admin/AdminMobileNav";
import AdminTopbar from "@/components/admin/AdminTopbar";
import PushNotificationBanner from "@/components/portal/PushNotificationBanner";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata = {
  title: "Admin - Marc Watters",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="portal-v2-shell admin-shell">
      <ToastProvider>
        <AdminSidebar />
        <div className="adm-main">
          <AdminTopbar />
          <main className="adm-content">
            <div className="portal-v2-content adm-page">
              <PushNotificationBanner />
              {children}
            </div>
          </main>
        </div>
        <AdminMobileNav />
      </ToastProvider>
    </div>
  );
}
