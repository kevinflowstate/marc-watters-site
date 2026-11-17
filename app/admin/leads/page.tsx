import { notFound } from "next/navigation";
import LeadsClient from "@/components/leads/LeadsClient";
import { requireAdmin } from "@/lib/admin-auth";
import { leadDmsAllowed } from "@/lib/lead-dms/config";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const auth = await requireAdmin();
  if (!auth.authorized || !leadDmsAllowed(auth.userId)) notFound();
  return <LeadsClient />;
}
