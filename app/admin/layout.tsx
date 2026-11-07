import AdminChrome from "@/components/admin/AdminChrome";

export const metadata = {
  title: "Admin - Marc Watters",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminChrome>{children}</AdminChrome>;
}
