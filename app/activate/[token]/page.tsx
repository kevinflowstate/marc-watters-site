import { redirect } from "next/navigation";

export default async function ActivationTokenRoute({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  redirect(`/activate?token=${encodeURIComponent(token)}`);
}
