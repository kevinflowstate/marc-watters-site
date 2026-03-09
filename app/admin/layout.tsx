import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminBackground from "@/components/admin/AdminBackground";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata = {
  title: "Admin - Marc Watters",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-bg-primary relative">
        <AdminBackground />
        <AdminSidebar />
        <main className="lg:ml-[260px] min-h-screen relative z-[1]">
          <div className="max-w-7xl mx-auto px-6 py-8">
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
