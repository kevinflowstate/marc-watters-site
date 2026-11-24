import { requireCron } from "@/lib/ops/auth";
import { ensureMorningBusinessOverview } from "@/lib/ops/business-overview-snapshot";
import { respond } from "@/lib/ops/http";

export const maxDuration = 120;
export async function GET(request: Request) {
  return respond(async () => {
    requireCron(request);
    // Vercel cron is UTC. Only one of the two candidate hours is 08:00 in London.
    const now = new Date();
    if (
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        hour: "2-digit",
        hourCycle: "h23",
      }).format(now) !== "08"
    )
      return { skipped: true };
    return { asOf: (await ensureMorningBusinessOverview()).asOf };
  });
}
