export const actionLabels = {
  content_scheduling: "Schedule social posts",
  lesson_publication: "Publish reviewed lessons",
  payment_reminders: "Send payment reminders",
  report_sending: "Send business reports",
  notifications: "Send notifications",
  portal_sending: "Send portal messages",
} as const;

export type PortalActionSwitches = Record<keyof typeof actionLabels, boolean>;

/** Missing fields must never produce an “everything is off” claim. */
export function sendingState(controls: Partial<PortalActionSwitches> | null | undefined) {
  if (!controls) return "unknown";
  if (Object.keys(actionLabels).some((k) => controls[k as keyof PortalActionSwitches] === true)) return "enabled";
  return Object.keys(actionLabels).every((k) => controls[k as keyof PortalActionSwitches] === false)
    ? "off" : "unknown";
}

type FailedConnection = { connected: false; message: string };
export type ConnectionStatus = {
  checked_at: string;
  read_only: true;
  ghl: FailedConnection | {
    connected: true;
    message: string;
    location: { id: string; name: string };
    user: { id: string; name: string };
    accounts: { id: string; name: string; platform: string; available: boolean }[];
  };
  drive: FailedConnection | {
    connected: true;
    message: string;
    source: { mode: "shared_files"; files: { id: string; name: string; version: string }[] };
  };
  controls: PortalActionSwitches;
  content_media_configured: boolean;
};

export function contentNextSteps(status: ConnectionStatus | null): string[] {
  if (!status) return ["Check the CRM and Drive connections, then check the prepared content."];
  const steps: string[] = [];
  if (!status.ghl.connected) steps.push("Flowstate needs to restore the CRM connection.");
  else if (!status.ghl.accounts.some((a) => a.available)) steps.push("Reconnect a social account in the CRM.");
  if (!status.drive.connected) steps.push("Flowstate needs to restore access to the shared content file.");
  steps.push(status.content_media_configured
    ? "Check each post’s images, destination and date in Prepared work. Image delivery has not been tested by this connection check."
    : "Flowstate needs to finish image delivery so the social platforms can fetch the approved images.");
  steps.push("Marc or Eimear reviews the exact post and saves a decision in Prepared work.");
  if (!status.controls.content_scheduling) steps.push("Scheduling is off. Approval alone will not publish or schedule anything.");
  return steps;
}

export function connectionError(status: number) {
  return status === 401 || status === 403
    ? "Your portal session needs checking. Sign in with an administrator account, then try again."
    : "The connections could not be checked. Try again; the previous result is no longer current.";
}
