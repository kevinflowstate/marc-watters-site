/** Preserve an admin's intended portal page across sign-in. Only accept plain local admin paths. */
export function adminReturnPath(target: string | null) {
  return target && /^\/admin(?:\/[A-Za-z0-9_-]+)*\/?$/.test(target) ? target : "/admin";
}
