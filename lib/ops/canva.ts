import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
export type CanvaField =
  | { type: "text"; text: string }
  | { type: "image"; asset_id: string };
export type AutofillInput = {
  brand_template_id: string;
  data: Record<string, CanvaField>;
};
export type OAuthSession = {
  verifier: string;
  state: string;
  created_at: number;
  redirect_uri: string;
};
export function beginCanvaOAuth(clientId: string, redirectUri: string) {
  if (!clientId)
    throw new Error("NEEDS KEVIN: Register the Canva developer app");
  const verifier = randomBytes(48).toString("base64url"),
    state = randomBytes(32).toString("base64url"),
    session: OAuthSession = {
      verifier,
      state,
      created_at: Date.now(),
      redirect_uri: redirectUri,
    };
  const url = new URL("https://www.canva.com/api/oauth/authorize");
  url.search = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    state,
    scope:
      "design:content:read design:content:write design:meta:read brandtemplate:content:read brandtemplate:meta:read asset:read asset:write",
  }).toString();
  return { url: url.toString(), session };
}
export async function completeCanvaOAuth(
  callback: { code: string; state: string },
  session: OAuthSession,
  clientId: string,
  clientSecret: string,
) {
  const a = Buffer.from(callback.state),
    b = Buffer.from(session.state);
  if (
    a.length !== b.length ||
    !timingSafeEqual(a, b) ||
    Date.now() - session.created_at > 600000
  )
    throw new Error("OAuth session invalid or expired");
  const r = await fetch("https://api.canva.com/rest/v1/oauth/token", {
    method: "POST",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: callback.code,
      code_verifier: session.verifier,
      redirect_uri: session.redirect_uri,
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`Canva token exchange returned ${r.status}`);
  return r.json();
}
function payload(input: AutofillInput) {
  if (!input.brand_template_id?.trim())
    throw new Error("NEEDS MARC: Brand template ID required");
  if (
    !input.data ||
    typeof input.data !== "object" ||
    !Object.keys(input.data).length
  )
    throw new Error("Autofill fields required");
  for (const value of Object.values(input.data)) {
    if (
      !value ||
      (value.type === "text" && typeof value.text !== "string") ||
      (value.type === "image" && typeof value.asset_id !== "string") ||
      !["text", "image"].includes(value.type)
    )
      throw new Error("Invalid text or image field");
  }
  return {
    type: "create_from_brand_template",
    brand_template_id: input.brand_template_id,
    data: input.data,
  };
}
async function api(path: string, token: string, body?: unknown) {
  const r = await fetch("https://api.canva.com/rest/v1" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      "content-type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok)
    throw new Error(
      `Canva ${path.split("/")[1]} returned ${r.status}; reconcile a creation before retrying`,
    );
  return r.json();
}
async function poll(path: string, token: string) {
  for (let i = 0; i < 60; i++) {
    const d = await api(path, token);
    if (d.job?.status === "success") return d.job;
    if (d.job?.status === "failed") throw new Error("Canva job failed");
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(
    "Canva job still processing; poll its saved job ID, do not create another",
  );
}
export async function autofillCanva(
  input: AutofillInput,
  options: {
    token?: string;
    dryRun?: boolean;
    onJob?: (type: string, id: string) => Promise<void>;
  } = {},
) {
  const body = payload(input);
  if (options.dryRun !== false)
    return {
      dry_run: true,
      requests: [
        {
          method: "GET",
          path: `/brand-templates/${input.brand_template_id}/dataset`,
        },
        { method: "POST", path: "/autofills", body },
        { method: "GET", path: "/autofills/{job_id}" },
        {
          method: "POST",
          path: "/exports",
          body: { design_id: "{result.design.id}", format: { type: "png" } },
        },
        { method: "GET", path: "/exports/{job_id}" },
      ],
    };
  if (!options.token)
    throw new Error("NEEDS KEVIN: Canva OAuth is not configured");
  const dataset = await api(
    `/brand-templates/${encodeURIComponent(input.brand_template_id)}/dataset`,
    options.token,
  );
  for (const [key, value] of Object.entries(input.data)) {
    const field = dataset.dataset?.[key];
    if (!field || field.type !== value.type)
      throw new Error(`Canva field missing or changed: ${key}`);
  }
  const created = await api("/autofills", options.token, body);
  await options.onJob?.("autofill", created.job.id);
  const complete = await poll(`/autofills/${created.job.id}`, options.token),
    design = complete.result.design;
  const exported = await api("/exports", options.token, {
    design_id: design.id,
    format: { type: "png" },
  });
  await options.onJob?.("export", exported.job.id);
  const result = await poll(`/exports/${exported.job.id}`, options.token);
  return {
    dry_run: false,
    design_id: design.id,
    design_urls: design.urls,
    export_urls: result.urls,
    expires_in_hours: 24,
  };
}
