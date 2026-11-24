import { respond, adminActor } from "@/lib/ops/http";
import { manualIntake } from "@/lib/ops/manual-intake";
export async function POST(request: Request) {
  return respond(async () => {
    const actor = await adminActor();
    return manualIntake(await request.json(), actor);
  });
}
