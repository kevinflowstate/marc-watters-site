import { requireAdmin } from "@/lib/admin-auth";
import { leadDmsAllowed } from "./config";

/** Admin check plus the Leads-tab allow-list. Hidden users get a 404, as if the tab did not exist. */
export async function requireLeadsAccess(): Promise<{ ok: true; userId: string } | { ok: false; status: number; error: string }> {
  const auth = await requireAdmin();
  if (!auth.authorized) return { ok: false, status: auth.status, error: auth.error };
  if (!leadDmsAllowed(auth.userId)) return { ok: false, status: 404, error: "Not found" };
  return { ok: true, userId: auth.userId };
}
