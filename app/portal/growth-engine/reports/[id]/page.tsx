import ClientReportDetail from "@/components/growth-engine/ClientReportDetail";

export default async function GrowthReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClientReportDetail reportId={id} />;
}
