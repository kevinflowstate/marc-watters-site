import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const state = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  rpc: [] as { fn: string; args: Record<string, unknown> }[],
  seq: 0,
}));
const ghl = vi.hoisted(() => ({
  findContactsByEmail: vi.fn(),
  addContactToWorkflow: vi.fn(),
  removeContactFromWorkflow: vi.fn(),
  getGhlContact: vi.fn(),
}));

// Small in-memory stand-in for the Supabase query builder used by payment-cases.
function query(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let op: "select" | "update" | "insert" | "delete" = "select";
  let patch: Row = {};
  let single = false;
  let max = Infinity;
  const rows = () => (state.tables[table] ||= []);
  const run = () => {
    if (op === "insert") {
      const row: Row = { id: `row-${++state.seq}`, created_at: new Date().toISOString(), ...patch };
      if (table === "ops_payment_case_events" && rows().some((r) => r.source === row.source && r.external_id === row.external_id))
        return { data: null, error: { code: "23505", message: "duplicate" } };
      if (table === "ops_payment_workflow_owners" && rows().some(r=>r.contact_id===row.contact_id || r.case_id===row.case_id))
        return { data:null, error:{code:"23505",message:"duplicate workflow"} };
      rows().push(row);
      return { data: null, error: null };
    }
    const hit = rows().filter((r) => filters.every((f) => f(r)));
    if (op === "delete") state.tables[table] = rows().filter(r=>!hit.includes(r));
    if (op === "update") hit.forEach((r) => Object.assign(r, patch, { updated_at: new Date().toISOString() }));
    const data = hit.slice(0, max).map((r) => ({ ...r }));
    return { data: single ? (data[0] ?? null) : data, error: null };
  };
  const q = {
    select: () => q,
    order: () => q,
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
    neq: (k: string, v: unknown) => (filters.push((r) => r[k] !== v), q),
    in: (k: string, v: unknown[]) => (filters.push((r) => v.includes(r[k])), q),
    is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), q),
    limit: (n: number) => ((max = n), q),
    maybeSingle: () => ((single = true), q),
    update: (p: Row) => ((op = "update"), (patch = p), q),
    delete: () => ((op = "delete"), q),
    insert: (p: Row) => ((op = "insert"), (patch = p), q),
    then: (resolve: (v: unknown) => unknown) => resolve(run()),
  };
  return q;
}
function rpc(fn: string, args: Record<string, unknown>) {
  state.rpc.push({ fn, args });
  const tasks = (state.tables.ops_tasks ||= []);
  if (fn === "ops_record_payment_snapshot") {
    const snap = args.p_snapshot as Row;
    const cases = (state.tables.ops_payment_cases ||= []);
    const events = (state.tables.ops_payment_case_events ||= []);
    let c = cases.find((r) => r.stripe_account_id === snap.stripe_account_id && r.invoice_id === snap.invoice_id);
    if (!c) {
      c = {
        id: `case-${++state.seq}`, contact_id: null, latest_delivery: null, reminder_count: 0,
        reply_needs_human: false, contact_dnd: false, manual_pause: false, task_id: null, first_failed_at: null,
      };
      cases.push(c);
    }
    if (events.some((e) => e.source === "stripe" && e.external_id === args.p_external))
      return Promise.resolve({ data: { duplicate: true, case: { ...c } }, error: null });
    events.push({ id: `ev-${++state.seq}`, case_id: c.id, source: "stripe", external_id: args.p_external, event_type: args.p_event_type, occurred_at: args.p_occurred });
    Object.assign(c, { ...snap, state: c.state === "paid" ? "paid" : snap.state });
    if (snap.state === "unpaid" && args.p_event_type === "invoice.payment_failed") c.first_failed_at ||= args.p_occurred;
    let t = tasks.find((x) => x.external_ref === `payment-case:${c.id}`);
    if (!t && c.state !== "paid") tasks.push((t = { id: `task-${++state.seq}`, external_ref: `payment-case:${c.id}`, status: "open", decision_note: null }));
    if (t && c.state === "paid") t.status = "done";
    c.task_id = t?.id ?? null;
    return Promise.resolve({ data: { duplicate: false, case: { ...c } }, error: null });
  }
  if (fn === "ops_apply_invoice_progress") {
    const c = state.tables.ops_payment_cases.find(r => r.id === args.p_case)!;
    const type = args.p_type;
    const external = `progress:${args.p_event_id}:${c.id}`;
    const events = state.tables.ops_payment_case_events;
    if (events.some(e=>e.external_id===external)) return {data:"duplicate", error:null};
    events.push({case_id:c.id, source:"ghl", event_type:type, external_id:external});
    if (type==="reply_received") c.reply_needs_human=true;
    else if (type==="dnd") c.contact_dnd=true;
    else if (type==="reminder_failed") { c.latest_delivery=type; c.manual_pause=true; }
    else if (type==="escalated") c.latest_delivery=type;
    else {
      const n = type==="reminder_1_sent"?1:2;
      if (n>=Number(c.reminder_count) && !c.manual_pause) c.latest_delivery=type;
      c.reminder_count=Math.max(Number(c.reminder_count),n);
    }
    return {data:"applied",error:null};
  }
  if (fn === "ops_mutate_task") {
    const data = args.p_data as Row;
    if (args.p_action === "create") {
      let t = tasks.find((x) => x.external_ref === data.external_ref);
      if (!t) tasks.push((t = { id: `task-${++state.seq}`, status: "open", decision_note: null }));
      Object.assign(t, { title: data.title, detail: data.detail, external_ref: data.external_ref });
      return Promise.resolve({ data: { ...t }, error: null });
    }
    const t = tasks.find((x) => x.id === args.p_id)!;
    // completion_reason is not a column: Eimear's decision_note survives.
    if (data.status) t.status = data.status;
    return Promise.resolve({ data: { ...t }, error: null });
  }
  return Promise.resolve({ data: null, error: { message: "unexpected rpc " + fn } });
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: query, rpc }) }));
vi.mock("@/lib/env", () => ({ getEnv: (key: string) => process.env[key] }));
vi.mock("@/lib/ops/ghl-workflow", () => ({ ...ghl, GhlWorkflowError: class extends Error {} }));
vi.mock("@/lib/ops/tasks", () => ({
  OpsError: class extends Error {
    constructor(message: string, public status = 400) { super(message); }
  },
  record: (input: unknown) => {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("JSON object required");
    return input as Record<string, unknown>;
  },
  uuid: (input: string) => input,
}));

import { receiveStripePaymentEvent, recordGhlPaymentProgress } from "../lib/ops/payment-cases";

const now = new Date("2026-11-06T12:00:00Z"); // Friday
const account = { alias: "mrw-a", account_id: "acct_MrwA", api_key: "fixture-key", webhook_secret: "fixture-secret", livemode: false, label: "MRW Management Ltd (A)" };
let invoiceStatus = "open";
let eventSeq = 0;
function stripeFetch() {
  return vi.fn(async (url: string) =>
    Response.json(
      url.endsWith("/account")
        ? { id: account.account_id }
        : {
            id: "in_Fixture", object: "invoice", livemode: false, status: invoiceStatus,
            amount_remaining: invoiceStatus === "open" ? 90000 : 0, currency: "gbp", customer: "cus_F",
            customer_email: "Client@Example.invalid", customer_name: "Example Client", number: "CBB-001",
            hosted_invoice_url: "https://invoice.stripe.com/i/abc",
          },
    ),
  );
}
async function stripeEvent(type: string) {
  const raw = JSON.stringify({
    id: `evt_Fixture${++eventSeq}`, type, livemode: false, created: Math.floor(Date.now() / 1000),
    data: { object: { id: "in_Fixture", object: "invoice" } },
  });
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", account.webhook_secret).update(`${t}.${raw}`).digest("hex");
  return receiveStripePaymentEvent(account.alias, raw, `t=${t},v1=${sig}`);
}
const theCase = () => state.tables.ops_payment_cases[0];
const theTask = () => state.tables.ops_tasks.find((t) => t.id === theCase().task_id)!;
const ghlEvents = (type: string) => (state.tables.ops_payment_case_events || []).filter((e) => e.event_type === type);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  state.tables = {};
  state.rpc = [];
  invoiceStatus = "open";
  vi.stubEnv("OPS_STRIPE_PAYMENT_ACCOUNTS_JSON", JSON.stringify({ [account.alias]: account }));
  vi.stubEnv("OPS_PAYMENT_REMINDERS_ENABLED", "true");
  vi.stubEnv("OPS_PAYMENT_WORKFLOW_ID", "5ef4aa6d-05f7-42e5-9c36-5c872f0ca2ed");
  vi.stubGlobal("fetch", stripeFetch());
  for (const fn of Object.values(ghl)) fn.mockReset();
  ghl.findContactsByEmail.mockResolvedValue([{ id: "contactFixture01", email: "client@example.invalid" }]);
  ghl.getGhlContact.mockResolvedValue({id:"contactFixture01", dnd:false});
  ghl.addContactToWorkflow.mockResolvedValue({ workflow_id: "5ef4aa6d-05f7-42e5-9c36-5c872f0ca2ed" });
  ghl.removeContactFromWorkflow.mockResolvedValue({ removed: true, not_in_workflow: false });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("failed payment -> GHL workflow enrolment", () => {
  it("enrols the single matching contact on a new unpaid case and stores contact + enrolment time", async () => {
    const result = await stripeEvent("invoice.payment_failed");
    expect(result.cases?.[0]).toMatchObject({ reminders: "enrolled" });
    expect(ghl.findContactsByEmail).toHaveBeenCalledWith("client@example.invalid");
    // Friday failure: reminder 1 is Monday 09:00 London, passed as the workflow event start time.
    expect(ghl.addContactToWorkflow).toHaveBeenCalledWith("contactFixture01", { eventStartTime: "2026-11-09T09:00:00.000Z" });
    expect(theCase()).toMatchObject({ contact_id: "contactFixture01", bound_at: now.toISOString(), latest_delivery: "enrolled" });
    expect(ghlEvents("enrolled")).toHaveLength(1);
    expect(String(theTask().detail)).toContain("MRW Management Ltd (A)");
    expect(String(theTask().detail)).toContain("£900.00");
    // Stripe retries the failure: no second enrolment.
    await stripeEvent("invoice.payment_failed");
    expect(ghl.addContactToWorkflow).toHaveBeenCalledOnce();
  });

  it("creates the case and task only when the switch is off", async () => {
    vi.stubEnv("OPS_PAYMENT_REMINDERS_ENABLED", "false");
    const result = await stripeEvent("invoice.payment_failed");
    expect(result.cases?.[0]).toMatchObject({ reminders: "reminders_off" });
    expect(ghl.findContactsByEmail).not.toHaveBeenCalled();
    expect(ghl.addContactToWorkflow).not.toHaveBeenCalled();
    expect(theCase().latest_delivery).toBe("reminders_off");
    expect(theTask().status).toBe("open");
    expect(String(theTask().detail)).toContain("reminders were off");
  });

  it.each([[[]], [[{ id: "contactFixture01" }, { id: "contactFixture02" }]]])(
    "does not enrol when %j contacts match, and tells Eimear to match it",
    async (matches) => {
      ghl.findContactsByEmail.mockResolvedValue(matches);
      await stripeEvent("invoice.payment_failed");
      expect(ghl.addContactToWorkflow).not.toHaveBeenCalled();
      expect(theCase()).toMatchObject({ latest_delivery: "no_contact_match", contact_id: null });
      expect(ghlEvents("no_contact_match")[0].data).toMatchObject({ matches: matches.length });
      expect(String(theTask().detail)).toContain(
        "No single CRM contact matched client@example.invalid; match it in the CRM, then add them to the reminder workflow",
      );
    },
  );

  it("checks the current CRM WhatsApp opt-out before enrolling", async () => {
    ghl.getGhlContact.mockResolvedValue({id:"contactFixture01", dndSettings:{WhatsApp:{status:"active"}}});
    await stripeEvent("invoice.payment_failed");
    expect(theCase()).toMatchObject({contact_dnd:true,latest_delivery:"held_for_review"});
    expect(ghl.addContactToWorkflow).not.toHaveBeenCalled();
  });

  it("records an enrolment failure on the case instead of failing the Stripe webhook", async () => {
    ghl.addContactToWorkflow.mockRejectedValue(new Error("CRM workflow enrolment failed (422)"));
    const result = await stripeEvent("invoice.payment_failed");
    expect(result.cases?.[0]).toMatchObject({ reminders: "enrol_failed" });
    expect(theCase().latest_delivery).toBe("enrol_failed");
  });

  it("removes the contact and closes the task on paid, keeping Eimear's note", async () => {
    await stripeEvent("invoice.payment_failed");
    theTask().decision_note = "Spoke to client, paying today";
    invoiceStatus = "paid";
    await stripeEvent("invoice.paid");
    expect(ghl.removeContactFromWorkflow).toHaveBeenCalledWith("contactFixture01");
    expect(ghlEvents("removed_from_workflow")).toHaveLength(1);
    expect(theTask()).toMatchObject({ status: "done", decision_note: "Spoke to client, paying today" });
    // A second paid notification does not remove again.
    await stripeEvent("invoice.payment_succeeded");
    expect(ghl.removeContactFromWorkflow).toHaveBeenCalledOnce();
  });

  it("removes and closes on void, treating 'not in workflow' as fine", async () => {
    await stripeEvent("invoice.payment_failed");
    ghl.removeContactFromWorkflow.mockResolvedValue({ removed: false, not_in_workflow: true });
    invoiceStatus = "void";
    const result = await stripeEvent("invoice.voided");
    expect(result.cases?.[0]).toMatchObject({ reminders: "not_in_workflow" });
    expect(theTask().status).toBe("done");
    expect(state.rpc.some((c) => c.fn === "ops_mutate_task" && (c.args.p_data as Row).completion_reason)).toBe(true);
  });
});

describe("GHL progress callbacks", () => {
  const progress = (event_type: string, event_id: string, extra: Row = {}) =>
    recordGhlPaymentProgress({ event_type, invoice_id:"in_Fixture", stripe_account_id:account.account_id, contact_id: "contactFixture01", occurred_at: "2026-11-06T11:01:00Z", event_id, ...extra });

  it("is idempotent on event_id", async () => {
    await stripeEvent("invoice.payment_failed");
    expect(await progress("reminder_1_sent", "wf-1")).toMatchObject({ duplicate: false, applied: 1 });
    expect(await progress("reminder_1_sent", "wf-1")).toMatchObject({ duplicate: true });
    expect(ghlEvents("reminder_1_sent")).toHaveLength(1);
    expect(theCase()).toMatchObject({ reminder_count: 1, latest_delivery: "reminder_1_sent" });
    await progress("reminder_2_sent", "wf-2");
    // A late reminder 1 never moves the status backwards.
    await progress("reminder_1_sent", "wf-1-late");
    expect(theCase()).toMatchObject({ reminder_count: 2, latest_delivery: "reminder_2_sent" });
  });

  it("escalation reopens Eimear's task with the detail", async () => {
    await stripeEvent("invoice.payment_failed");
    theTask().status = "done";
    await progress("reminder_1_sent","wf-1");
    await progress("reminder_2_sent","wf-2");
    await progress("escalated", "wf-esc");
    expect(theTask().status).toBe("open");
    expect(String(theTask().title)).toContain("Eimear: follow up");
    expect(String(theTask().detail)).toContain("Both reminders have gone and the invoice is still unpaid");
  });

  it("reply and DND mark the case as needing a person", async () => {
    await stripeEvent("invoice.payment_failed");
    await progress("reply_received", "wf-reply");
    expect(theCase().reply_needs_human).toBe(true);
    await progress("dnd", "wf-dnd");
    expect(theCase().contact_dnd).toBe(true);
    expect(theTask().status).toBe("open");
  });

  it("records delivery only for its original merchant and invoice, including delayed callbacks", async () => {
    await stripeEvent("invoice.payment_failed");
    state.tables.ops_payment_cases.push({...theCase(), id:"case-other", stripe_account_id:"acct_Other", task_id:null});
    await expect(progress("reminder_1_sent","missing",{invoice_id:undefined})).rejects.toThrow("original invoice_id");
    await expect(progress("reminder_1_sent","missing",{stripe_account_id:undefined})).rejects.toThrow("stripe_account_id");
    expect(await progress("reminder_1_sent","wf-1")).toMatchObject({matched:1,applied:1});
    expect(state.tables.ops_payment_cases[1].reminder_count).toBe(0);
    invoiceStatus="paid";
    await stripeEvent("invoice.paid");
    expect(await progress("reminder_2_sent","wf-2")).toMatchObject({matched:0});
    expect(state.tables.ops_payment_cases[1].reminder_count).toBe(0);
  });

  it("stops all open cases on a contact-wide reply or opt-out", async () => {
    await stripeEvent("invoice.payment_failed");
    state.tables.ops_payment_cases.push({ ...theCase(), id: "case-other", invoice_id: "in_Other", task_id: null });
    expect(await progress("reply_received","wf-many",{invoice_id:undefined,stripe_account_id:undefined})).toMatchObject({matched:2,applied:2});
    expect(state.tables.ops_payment_cases.every(c=>c.reply_needs_human)).toBe(true);
    expect(ghl.removeContactFromWorkflow).toHaveBeenCalledOnce();
    expect(await progress("dnd","wf-dnd")).toMatchObject({matched:2});
  });

  it("hands a failed WhatsApp to Eimear without counting a send", async () => {
    await stripeEvent("invoice.payment_failed");
    await progress("reminder_failed","wf-failed");
    expect(theCase()).toMatchObject({latest_delivery:"reminder_failed",manual_pause:true,reminder_count:0});
    expect(ghl.removeContactFromWorkflow).toHaveBeenCalledOnce();
    expect(String(theTask().detail)).toContain("failed WhatsApp");
  });

  it("holds a second invoice and its settlement cannot cancel the first workflow", async () => {
    const previous = {case_id:"other-case",contact_id:"contactFixture01",phase:"active"};
    state.tables.ops_payment_workflow_owners=[previous];
    await stripeEvent("invoice.payment_failed");
    expect(theCase().latest_delivery).toBe("held_for_review");
    expect(ghl.addContactToWorkflow).not.toHaveBeenCalled();
    invoiceStatus="paid";
    await stripeEvent("invoice.paid");
    expect(ghl.removeContactFromWorkflow).not.toHaveBeenCalled();
    expect(state.tables.ops_payment_workflow_owners).toEqual([previous]);
  });

  it("rejects unknown event types and ignores contacts with no open case", async () => {
    await expect(progress("reminder_sent", "x")).rejects.toThrow("event_type");
    await expect(recordGhlPaymentProgress({ event_type: "dnd", contact_id: "bad id", occurred_at: "2026-11-09T09:00:00Z", event_id: "x" })).rejects.toThrow();
    expect(await progress("dnd", "wf-none")).toMatchObject({ matched: 0 });
  });
});
