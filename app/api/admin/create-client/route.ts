import { POST as inviteClient } from "@/app/api/admin/invite-client/route";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  headers.delete("content-length");

  return inviteClient(new Request(request.url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...body,
      name: body.name || body.full_name,
    }),
  }));
}
