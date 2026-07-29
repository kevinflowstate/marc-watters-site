import GrowthEngineClientWorkspace from "@/components/growth-engine/GrowthEngineClientWorkspace";

export default async function AdminGrowthEngineClientPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return <GrowthEngineClientWorkspace clientId={clientId} />;
}
