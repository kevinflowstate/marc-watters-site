import { redirect } from "next/navigation";

/** Prepared work now lives inside the Workspace. Old deep links keep working. */
export default async function AutomationRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["artifact", "payment", "task"]) {
    const value = params[key];
    if (typeof value === "string" && value) query.set(key, value);
  }
  const suffix = query.toString();
  redirect(`/admin/work${suffix ? `?${suffix}` : ""}`);
}
