import AdminSidebar from "@/components/admin/AdminSidebar";

export const metadata = {
  title: "Admin - Marc Watters",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-primary">
      <AdminSidebar />
      <main className="lg:ml-[260px] min-h-screen">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
