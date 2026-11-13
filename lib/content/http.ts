import { NextResponse } from "next/server";
import { OpsError } from "@/lib/ops/tasks";
/** Never log upstream exceptions: they may include signed media URLs or connection data. */
export async function contentResponse(action: () => Promise<unknown>) {
  try {
    return NextResponse.json(await action(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof OpsError
            ? e.message
            : e instanceof SyntaxError
              ? "Invalid JSON"
              : "Content operation could not be completed",
      },
      {
        status:
          e instanceof OpsError
            ? e.status
            : e instanceof SyntaxError
              ? 400
              : 500,
      },
    );
  }
}
