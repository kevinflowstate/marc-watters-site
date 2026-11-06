import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConnectionDetails } from "../components/ops/workspace/ConnectionChecks";
import { actionLabels, connectionError, contentNextSteps, sendingState, type ConnectionStatus } from "../lib/ops/connection-status";
import { portalActionSwitches } from "../lib/ops/portal-controls";

function connected(): ConnectionStatus {
  return {
    checked_at: "2026-11-06T17:00:00Z", read_only: true,
    ghl: { connected: true, message: "connected", location: { id: "location-private", name: "MRW Management LTD" },
      user: { id: "private-user", name: "Marc" }, accounts: [
        { id: "private-social", name: "Marc’s Instagram", platform: "instagram", available: true },
        { id: "expired-social", name: "Marc’s Facebook", platform: "facebook", available: false },
      ] },
    drive: { connected: true, message: "connected", source: { mode: "shared_files", files: [{ id: "private-file", name: "pack.json", version: "3" }] } },
    content_media_configured: false,
    controls: Object.fromEntries(Object.keys(actionLabels).map((k) => [k, false])) as ConnectionStatus["controls"],
  };
}

afterEach(() => vi.unstubAllEnvs());
describe("connection and action status a person can rely on", () => {
  it("requires every action switch before claiming sending is off", () => {
    expect(sendingState(undefined)).toBe("unknown");
    expect(sendingState({ content_scheduling: false })).toBe("unknown");
    expect(sendingState(connected().controls)).toBe("off");
    for (const key of Object.keys(actionLabels)) {
      expect(sendingState({ ...connected().controls, [key]: true })).toBe("enabled");
    }
  });
  it("reports an enabled switch even when execution lacks credentials or media", () => {
    vi.stubEnv("OPS_CONTENT_SCHEDULING_ENABLED", "true");
    vi.stubEnv("CBB_GHL_PIT_TOKEN", "");
    vi.stubEnv("CBB_GHL_USER_ID", "");
    vi.stubEnv("OPS_CONTENT_MEDIA_HOSTS", "");
    vi.stubEnv("FLOWSTATE_PORTAL_SEND_ENABLED", "true");
    vi.stubEnv("OPS_LEGACY_LESSON_PIPELINE_ENABLED", "true");
    expect(portalActionSwitches()).toMatchObject({ content_scheduling: true, portal_sending: true, legacy_lesson_pipeline: true });
    expect(sendingState(portalActionSwitches())).toBe("enabled");
  });
  it("shows real account names, reconnect status and file-only scope without raw IDs", () => {
    const html = renderToStaticMarkup(createElement(ConnectionDetails, { status: connected() }));
    expect(html).toContain("MRW Management LTD");
    expect(html).toContain("Reconnect");
    expect(html).toContain("cannot edit them or browse Marc’s wider Drive");
    expect(html).toContain("All seven portal action switches are off");
    expect(html).toContain("cannot verify or change their schedules");
    expect(html).not.toMatch(/private-social|private-file|private-user|location-private/);
    expect(html).not.toContain("OPS_");
  });
  it("keeps a failed source separate and does not expose provider diagnostics", () => {
    const status = connected();
    status.drive = { connected: false, message: "PRIVATE_UPSTREAM_ERROR" };
    const html = renderToStaticMarkup(createElement(ConnectionDetails, { status }));
    expect(html).toContain("MRW Management LTD");
    expect(html).toContain("The shared content file could not be read");
    expect(html).not.toContain("PRIVATE_UPSTREAM_ERROR");
    expect(contentNextSteps(status).join(" ")).toContain("restore access");
  });
  it("does not confuse connected sources or configured media with a tested, approved pack", () => {
    const status = connected();
    status.content_media_configured = true;
    const steps = contentNextSteps(status).join(" ");
    expect(steps).toContain("has not been tested");
    expect(steps).toContain("reviews the exact post");
    expect(steps).toContain("Scheduling is off");
    expect(contentNextSteps(null).join(" ")).toContain("Check the CRM and Drive");
  });
  it("names missing social connections and does not claim reminders are proven", () => {
    const status = connected();
    if (status.ghl.connected) status.ghl.accounts.forEach((a) => { a.available = false; });
    expect(contentNextSteps(status)).toContain("Reconnect a social account in the CRM.");
    const html = renderToStaticMarkup(createElement(ConnectionDetails, { status }));
    expect(html).toContain("must verify the WhatsApp templates");
    expect(html).toContain("full video download, edit and review needs its own test");
  });
  it("gives a session-specific recovery step and invalidates an old successful check", () => {
    expect(connectionError(401)).toContain("Sign in");
    expect(connectionError(403)).toContain("administrator account");
    expect(connectionError(502)).toContain("previous result is no longer current");
  });
});
