import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { MARC_USER_ID } from "@/lib/ops/team-identities";
import SalesCallRegister from "@/components/ops/SalesCallRegister";
export default async function SalesCalls() {
  const auth = await requireAdmin();
  if (!auth.authorized || auth.userId !== MARC_USER_ID) notFound();
  return <SalesCallRegister />;
}
