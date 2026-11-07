import { adminActor, respond } from "@/lib/ops/http";
import { listArtifacts } from "@/lib/ops/actions";
import { listPaymentCases } from "@/lib/ops/payment-cases";
import { automationControls } from "@/lib/ops/artifact-execution";
export async function GET() {
  return respond(async () => {
    await adminActor();
    const [artifacts, payments] = await Promise.all([
      listArtifacts(),
      listPaymentCases(),
    ]);
    return { artifacts, payments, controls: automationControls() };
  });
}
