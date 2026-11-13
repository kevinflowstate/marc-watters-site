import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import ContentPage from "./ContentPage";
import { sampleVideos } from "./sample";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ sample?: string }>;
}) {
  const auth = await requireAdmin();
  if (!auth.authorized) redirect("/login");
  const sample =
    process.env.VERCEL_ENV?.trim() === "preview" &&
    (await searchParams).sample === "1";
  return <ContentPage sample={sample ? sampleVideos() : undefined} />;
}
