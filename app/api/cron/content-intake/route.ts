import { requireCron } from "@/lib/ops/auth";
import { contentResponse } from "@/lib/content/http";
import { intake } from "@/lib/content/intake";
export const maxDuration = 300;
export async function GET(request: Request) {
  return contentResponse(async () => {
    requireCron(request);
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        hour: "2-digit",
        hourCycle: "h23",
      }).format(new Date()),
    );
    if (hour < 8 || hour > 22) return { skipped: "Outside 08:00–22:00 London" };
    return intake();
  });
}
