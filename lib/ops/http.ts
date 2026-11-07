import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";
import { OpsError } from "./tasks";
export async function adminActor() {
  const auth = await requireAdmin();
  if (!auth.authorized) throw new OpsError(auth.error, auth.status);
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  return user!.id;
}
export async function respond(fn: () => Promise<unknown>) {
  try {
    return NextResponse.json(await fn());
  } catch (e) {
    console.error(
      "Ops request failed",
      e instanceof Error ? e.message : "Unknown error",
    );
    if (e instanceof SyntaxError)
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    return NextResponse.json(
      {
        error:
          e instanceof OpsError
            ? e.message
            : "Operation could not be completed",
      },
      { status: e instanceof OpsError ? e.status : 500 },
    );
  }
}
export function taskFilters(request: Request) {
  const p = new URL(request.url).searchParams;
  return {
    status: p.get("status") || undefined,
    area: p.get("area") || undefined,
    assignee: p.get("assignee") || undefined,
    clientId: p.get("clientId") || undefined,
  };
}
