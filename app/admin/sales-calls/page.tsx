import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import SalesCallRegister from "@/components/ops/SalesCallRegister";
export default async function SalesCalls() {
  const auth = await requireAdmin();
  if (!auth.authorized) notFound();
  return <SalesCallRegister />;
}
