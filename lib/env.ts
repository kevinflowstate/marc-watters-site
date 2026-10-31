function normalizeEnvValue(value: string | undefined) {
  if (!value) return value;
  return value.replace(/\\n/g, "").trim();
}

export function getEnv(name: string) {
  return normalizeEnvValue(process.env[name]);
}

// All Ops credentials stay server-only and share paste/newline normalisation.
export function opsEnv() {
  return Object.fromEntries(["OPS_API_TOKEN","OPS_WEBHOOK_SECRET","FATHOM_API_KEY","FATHOM_WEBHOOK_SECRET","RENDER_HOST_URL","RENDER_HOST_SECRET","GHL_LOCATION_TOKEN","OPS_REPORT_SEND_ENABLED","OPS_NOTIFICATIONS_ENABLED","ANTHROPIC_API_KEY","CRON_SECRET","WEBHOOK_SECRET","RESEND_API_KEY"].map(name=>[name,getEnv(name)]));
}
