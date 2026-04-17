function normalizeEnvValue(value: string | undefined) {
  if (!value) return value;
  return value.replace(/\\n/g, "").trim();
}

export function getEnv(name: string) {
  return normalizeEnvValue(process.env[name]);
}
