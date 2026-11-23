"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { WsNotice as InlineNotice } from "@/components/portal/WsState";
import { Icon } from "@/components/ops/workspace/WorkspaceUI";
import { useToast } from "@/components/ui/Toast";
import {
  formatMoney,
  GROWTH_ENGINE_BOOKING_PATH,
  isCancelledStatus,
  PIPELINE_STAGES,
  STAGE_META,
  type PipelineDeal,
  type PipelineStage,
} from "@/lib/growth-engine-pipeline";

const PUBLIC_SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://constructionbusinessblueprint.co.uk").replace(/\/$/, "");
const BOOKING_URL = `${PUBLIC_SITE}${GROWTH_ENGINE_BOOKING_PATH}`;

type Focus = "proposal" | "follow_up" | "lost" | null;

function byPosition(a: PipelineDeal, b: PipelineDeal) {
  return a.position - b.position || b.created_at.localeCompare(a.created_at);
}

function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
}

function callLabel(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const past = d.getTime() < Date.now();
  const text = d.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
  return { past, text: past ? `Called ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" })}` : text };
}

function dayLabel(date: string | null) {
  if (!date) return null;
  const d = new Date(`${date}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 864e5);
  const text = diff === 0 ? "today" : diff === 1 ? "tomorrow" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return { text, due: diff <= 0 };
}

function hasProposal(deal: PipelineDeal) {
  return !!(deal.proposal_url || deal.has_proposal_file || deal.proposal_value);
}

export default function PipelineBoard() {
  const { toast } = useToast();
  const [deals, setDeals] = useState<PipelineDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ stage: PipelineStage; index: number } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [focus, setFocus] = useState<Focus>(null);
  const [adding, setAdding] = useState(false);
  const [now, setNow] = useState(0);
  const columnRefs = useRef<Partial<Record<PipelineStage, HTMLDivElement | null>>>({});

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/growth-engine/pipeline", { cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) throw new Error(data?.error || "The pipeline could not be loaded.");
    setDeals(data.deals || []);
    setNow(Date.now());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch, state lands after the request resolves
    load().catch((e) => setError((e as Error).message)).finally(() => setLoading(false));
    // Keep the board fresh while it is open (new bookings land from the calendar).
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load().catch(() => {});
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const columns = useMemo(() => {
    const map = Object.fromEntries(PIPELINE_STAGES.map((s) => [s, [] as PipelineDeal[]])) as Record<PipelineStage, PipelineDeal[]>;
    for (const deal of deals) map[deal.stage]?.push(deal);
    for (const s of PIPELINE_STAGES) map[s].sort(byPosition);
    return map;
  }, [deals]);

  const stats = useMemo(() => {
    const open = deals.filter((d) => d.stage === "call_booked" || d.stage === "proposal" || d.stage === "follow_up");
    const upcoming = deals.filter((d) => d.stage === "call_booked" && d.appointment_at && new Date(d.appointment_at).getTime() > now && !isCancelledStatus(d.appointment_status));
    const proposals = deals.filter((d) => d.stage === "proposal" || d.stage === "follow_up");
    const won = deals.filter((d) => d.stage === "won");
    const lost = deals.filter((d) => d.stage === "lost");
    const sum = (list: PipelineDeal[]) => list.reduce((t, d) => t + (d.proposal_value || 0), 0);
    const decided = won.length + lost.length;
    return {
      open: open.length,
      upcoming: upcoming.length,
      proposalValue: sum(proposals),
      proposals: proposals.length,
      wonValue: sum(won),
      won: won.length,
      winRate: decided ? Math.round((won.length / decided) * 100) : null,
    };
  }, [deals, now]);

  const patchDeal = useCallback(async (id: string, patch: Record<string, unknown>) => {
    const response = await fetch(`/api/admin/growth-engine/pipeline/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.deal) throw new Error(data?.error || "The lead could not be saved.");
    setDeals((list) => list.map((d) => (d.id === id ? data.deal : d)));
    return data.deal as PipelineDeal;
  }, []);

  function replaceDeal(deal: PipelineDeal) {
    setDeals((list) => (list.some((d) => d.id === deal.id) ? list.map((d) => (d.id === deal.id ? deal : d)) : [deal, ...list]));
  }

  /* ---------- Drag and drop ---------- */

  function indexFromPointer(stage: PipelineStage, clientY: number) {
    const col = columnRefs.current[stage];
    if (!col) return columns[stage].length;
    const cards = Array.from(col.querySelectorAll<HTMLElement>("[data-card]")).filter((el) => el.dataset.card !== dragId);
    for (let i = 0; i < cards.length; i += 1) {
      const rect = cards[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return i;
    }
    return cards.length;
  }

  function onDragOver(event: DragEvent, stage: PipelineStage) {
    if (!dragId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const index = indexFromPointer(stage, event.clientY);
    if (!over || over.stage !== stage || over.index !== index) setOver({ stage, index });
  }

  async function moveDeal(id: string, stage: PipelineStage, index: number) {
    const deal = deals.find((d) => d.id === id);
    if (!deal) return;
    const siblings = columns[stage].filter((d) => d.id !== id);
    const before = siblings[index - 1];
    const after = siblings[index];
    const position = before && after ? (before.position + after.position) / 2 : before ? before.position + 1 : after ? after.position - 1 : 0;
    if (deal.stage === stage && deal.position === position) return;
    const previous = deals;
    setDeals((list) => list.map((d) => (d.id === id ? { ...d, stage, position } : d)));
    try {
      const saved = await patchDeal(id, { stage, position });
      if (deal.stage !== stage) {
        toast(`${saved.contact_name} moved to ${STAGE_META[stage].label}`);
        if (stage === "proposal" && !hasProposal(saved)) openDrawer(id, "proposal");
        if (stage === "follow_up" && !saved.follow_up_at) openDrawer(id, "follow_up");
        if (stage === "lost" && !saved.lost_reason) openDrawer(id, "lost");
      }
    } catch (e) {
      setDeals(previous);
      toast((e as Error).message, "error");
    }
  }

  function onDrop(event: DragEvent, stage: PipelineStage) {
    event.preventDefault();
    const id = dragId || event.dataTransfer.getData("text/plain");
    const index = over?.stage === stage ? over.index : indexFromPointer(stage, event.clientY);
    setDragId(null);
    setOver(null);
    if (id) void moveDeal(id, stage, index);
  }

  function openDrawer(id: string, nextFocus: Focus = null) {
    setFocus(nextFocus);
    setOpenId(id);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(BOOKING_URL);
      toast("Booking link copied");
    } catch {
      toast(BOOKING_URL);
    }
  }

  const openDeal = deals.find((d) => d.id === openId) || null;

  return (
    <div className="ge-pipeline">
      <div className="ge-toolbar">
        <div className="ge-link">
          <Icon name="link" size={14} />
          <span className="ge-link-url">{BOOKING_URL.replace(/^https?:\/\//, "")}</span>
          <button type="button" className="ws-btn ws-btn-sm ws-focus" onClick={copyLink}>Copy link</button>
          <a className="ws-btn ws-btn-sm ws-btn-quiet ws-focus" href={GROWTH_ENGINE_BOOKING_PATH} target="_blank" rel="noreferrer">
            <Icon name="external" size={13} />
            <span className="sr-only">Open booking page</span>
          </a>
        </div>
        <button type="button" className="ws-btn ws-btn-primary ws-focus" onClick={() => setAdding(true)}>
          <Icon name="plus" size={14} />
          Add lead
        </button>
      </div>

      <section className="ge-stats" aria-label="Pipeline summary">
        <Stat label="Open pipeline" value={String(stats.open)} detail={stats.upcoming ? `${stats.upcoming} call${stats.upcoming === 1 ? "" : "s"} coming up` : "No calls booked ahead"} />
        <Stat label="Proposals out" value={stats.proposalValue ? formatMoney(stats.proposalValue) : String(stats.proposals)} detail={`${stats.proposals} awaiting a decision`} />
        <Stat label="Won" value={stats.wonValue ? formatMoney(stats.wonValue) : String(stats.won)} detail={`${stats.won} signed`} tone="ok" />
        <Stat label="Win rate" value={stats.winRate === null ? "-" : `${stats.winRate}%`} detail="Won out of decided" />
      </section>

      {error && <InlineNotice tone="error">{error}</InlineNotice>}

      <div className="ge-board" aria-busy={loading}>
        {PIPELINE_STAGES.map((stage) => {
          const list = columns[stage];
          const meta = STAGE_META[stage];
          const total = list.reduce((t, d) => t + (d.proposal_value || 0), 0);
          const isOver = over?.stage === stage;
          return (
            <div
              key={stage}
              ref={(el) => { columnRefs.current[stage] = el; }}
              className={`ge-col is-${meta.tone}${isOver ? " is-over" : ""}`}
              onDragOver={(e) => onDragOver(e, stage)}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o?.stage === stage ? null : o));
              }}
              onDrop={(e) => onDrop(e, stage)}
              aria-label={`${meta.label}, ${list.length} lead${list.length === 1 ? "" : "s"}`}
              role="list"
            >
              <header className="ge-col-head">
                <span className="ge-dot" aria-hidden />
                <span className="ge-col-title">{meta.label}</span>
                <span className="ge-col-count">{list.length}</span>
                {total > 0 && <span className="ge-col-total">{formatMoney(total)}</span>}
              </header>
              <div className="ge-col-body">
                {loading && stage === "call_booked" && [0, 1].map((i) => <div key={i} className="ge-card is-skeleton" />)}
                {list.map((deal, i) => (
                  <div key={deal.id} role="listitem" className="ge-slot">
                    {isOver && over?.index === i && dragId !== deal.id && <div className="ge-drop-line" aria-hidden />}
                    <DealCard
                      deal={deal}
                      dragging={dragId === deal.id}
                      onOpen={() => openDrawer(deal.id)}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", deal.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragId(deal.id);
                      }}
                      onDragEnd={() => { setDragId(null); setOver(null); }}
                    />
                  </div>
                ))}
                {isOver && over && over.index >= list.filter((d) => d.id !== dragId).length && <div className="ge-drop-line" aria-hidden />}
                {!loading && list.length === 0 && (
                  <p className="ge-col-empty">{stage === "call_booked" ? "New bookings appear here automatically." : isOver ? "Drop here" : meta.hint}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {openDeal && (
        <DealDrawer
          key={openDeal.id}
          deal={openDeal}
          focus={focus}
          onClose={() => { setOpenId(null); setFocus(null); }}
          onSave={patchDeal}
          onReplace={replaceDeal}
          onDeleted={(id) => { setDeals((list) => list.filter((d) => d.id !== id)); setOpenId(null); }}
        />
      )}
      {adding && (
        <AddLeadDialog
          onClose={() => setAdding(false)}
          onAdded={(deal) => { replaceDeal(deal); setAdding(false); toast(`${deal.contact_name} added`); }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: "ok" }) {
  return (
    <div className={`ge-stat${tone ? ` is-${tone}` : ""}`}>
      <p className="ge-stat-l">{label}</p>
      <p className="ge-stat-n">{value}</p>
      <p className="ge-stat-s">{detail}</p>
    </div>
  );
}

function DealCard({
  deal,
  dragging,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  deal: PipelineDeal;
  dragging: boolean;
  onOpen: () => void;
  onDragStart: (e: DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
}) {
  const call = callLabel(deal.appointment_at);
  const follow = dayLabel(deal.follow_up_at);
  const cancelled = isCancelledStatus(deal.appointment_status);
  return (
    <button
      type="button"
      data-card={deal.id}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className={`ge-card ws-focus${dragging ? " is-dragging" : ""}`}
    >
      <span className="ge-card-top">
        <span className="ge-avatar" aria-hidden>{initials(deal.contact_name)}</span>
        <span className="min-w-0">
          <span className="ge-card-name">{deal.contact_name}</span>
          <span className="ge-card-sub">{deal.business_name || deal.email || deal.phone || "No contact details"}</span>
        </span>
      </span>
      <span className="ge-card-meta">
        {call && !cancelled && (
          <span className={`ge-tag${call.past ? "" : " is-blue"}`}>
            <Icon name="calendar" size={11} />
            {call.text}
          </span>
        )}
        {cancelled && <span className="ge-tag is-bad">Call cancelled</span>}
        {deal.proposal_value ? <span className="ge-tag is-money">{formatMoney(deal.proposal_value)}</span> : null}
        {(deal.proposal_url || deal.has_proposal_file) && (
          <span className="ge-tag"><Icon name="content" size={11} />Proposal</span>
        )}
        {follow && deal.stage === "follow_up" && (
          <span className={`ge-tag${follow.due ? " is-attn" : ""}`}><Icon name="clock" size={11} />{follow.text}</span>
        )}
        {deal.client_id && <span className="ge-tag is-cbb">CBB client</span>}
      </span>
    </button>
  );
}

function DealDrawer({
  deal,
  focus,
  onClose,
  onSave,
  onReplace,
  onDeleted,
}: {
  deal: PipelineDeal;
  focus: Focus;
  onClose: () => void;
  onSave: (id: string, patch: Record<string, unknown>) => Promise<PipelineDeal>;
  onReplace: (deal: PipelineDeal) => void;
  onDeleted: (id: string) => void;
}) {
  const { toast } = useToast();
  const ref = useRef<HTMLDialogElement>(null);
  const proposalRef = useRef<HTMLInputElement>(null);
  const followRef = useRef<HTMLInputElement>(null);
  const lostRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(() => ({
    contact_name: deal.contact_name,
    business_name: deal.business_name || "",
    email: deal.email || "",
    phone: deal.phone || "",
    proposal_url: deal.proposal_url || "",
    proposal_value: deal.proposal_value === null ? "" : String(deal.proposal_value),
    proposal_sent_at: deal.proposal_sent_at || "",
    follow_up_at: deal.follow_up_at || "",
    lost_reason: deal.lost_reason || "",
    notes: deal.notes || "",
  }));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    const target = focus === "proposal" ? proposalRef : focus === "follow_up" ? followRef : focus === "lost" ? lostRef : null;
    if (target?.current) {
      window.setTimeout(() => {
        target.current?.scrollIntoView({ block: "center", behavior: "smooth" });
        target.current?.focus();
      }, 260);
    }
  }, [focus]);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const dirty = (Object.keys(form) as (keyof typeof form)[]).some((key) => {
    const original = key === "proposal_value" ? (deal.proposal_value === null ? "" : String(deal.proposal_value)) : (deal[key] as string | null) || "";
    return form[key] !== original;
  });

  async function save(extra: Record<string, unknown> = {}) {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...form, ...extra };
      if (form.proposal_url && !/^https?:\/\//i.test(form.proposal_url)) payload.proposal_url = `https://${form.proposal_url}`;
      if (!payload.proposal_sent_at && (form.proposal_url || form.proposal_value) && deal.stage === "proposal" && !deal.proposal_sent_at) {
        payload.proposal_sent_at = new Date().toISOString().slice(0, 10);
      }
      await onSave(deal.id, payload);
      toast("Saved");
      return true;
    } catch (e) {
      toast((e as Error).message, "error");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function moveTo(stage: PipelineStage) {
    if (stage === deal.stage) return;
    setSaving(true);
    try {
      await onSave(deal.id, dirty ? { ...form, stage } : { stage });
      toast(`Moved to ${STAGE_META[stage].label}`);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function upload(file: File) {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`/api/admin/growth-engine/pipeline/${deal.id}/proposal`, { method: "POST", body });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.deal) throw new Error(data?.error || "File could not be uploaded.");
      onReplace(data.deal);
      toast("Proposal attached");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeFile() {
    const response = await fetch(`/api/admin/growth-engine/pipeline/${deal.id}/proposal`, { method: "DELETE" });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.deal) return toast(data?.error || "File could not be removed.", "error");
    onReplace(data.deal);
  }

  async function remove() {
    if (!confirmDelete) return setConfirmDelete(true);
    const response = await fetch(`/api/admin/growth-engine/pipeline/${deal.id}`, { method: "DELETE" });
    if (!response.ok) return toast("The lead could not be removed.", "error");
    toast(`${deal.contact_name} removed`);
    onDeleted(deal.id);
  }

  async function close() {
    if (dirty && !(await save())) return;
    ref.current?.close();
    onClose();
  }

  const call = callLabel(deal.appointment_at);
  const cancelled = isCancelledStatus(deal.appointment_status);

  return (
    <dialog
      ref={ref}
      className="ws-drawer ws ge-drawer"
      aria-label={deal.contact_name}
      onCancel={(e) => { e.preventDefault(); void close(); }}
      onClick={(e) => { if (e.target === ref.current) void close(); }}
    >
      <div className="ws-drawer-head">
        <div className="ws-drawer-crumb">
          <span>Growth Engine</span>
          <span className="ws-sep">/</span>
          <span>{STAGE_META[deal.stage].label}</span>
        </div>
        <button type="button" onClick={() => void close()} className="ws-btn ws-btn-quiet ws-btn-icon ws-focus ml-auto" aria-label="Close">
          <Icon name="close" size={16} />
        </button>
      </div>

      <div className="ws-drawer-body">
        <div>
          <h2 className="ws-drawer-title">{deal.contact_name}</h2>
          <p className="ws-caption mt-1">
            {deal.source === "calendar" ? "Booked through the Growth Engine page" : "Added by hand"}
            {deal.client_id ? " · Marc's client" : ""}
          </p>
        </div>

        <div className="ws-section">
          <p className="ws-field-l">Stage</p>
          <div className="ge-stage-pick" role="group" aria-label="Move to stage">
            {PIPELINE_STAGES.map((stage) => (
              <button
                key={stage}
                type="button"
                aria-pressed={deal.stage === stage}
                disabled={saving}
                onClick={() => void moveTo(stage)}
                className={`ge-stage-btn is-${STAGE_META[stage].tone} ws-focus`}
              >
                <span className="ge-dot" aria-hidden />
                {STAGE_META[stage].label}
              </button>
            ))}
          </div>
        </div>

        <div className="ws-section ge-glass-box">
          <h3 className="ws-h3">Consultation</h3>
          {call ? (
            <p className="ge-call">
              <Icon name="calendar" size={14} />
              {new Date(deal.appointment_at!).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })}
              {cancelled && <span className="ge-tag is-bad">Cancelled</span>}
            </p>
          ) : (
            <p className="ws-caption">No call time recorded.</p>
          )}
          <div className="ge-fields">
            <Field label="Name"><input className="ws-input" value={form.contact_name} onChange={set("contact_name")} /></Field>
            <Field label="Business"><input className="ws-input" value={form.business_name} onChange={set("business_name")} placeholder="Business name" /></Field>
            <Field label="Email"><input className="ws-input" type="email" value={form.email} onChange={set("email")} /></Field>
            <Field label="Phone"><input className="ws-input" type="tel" value={form.phone} onChange={set("phone")} /></Field>
          </div>
          <div className="ws-acts">
            {deal.email && <a className="ws-btn ws-btn-sm ws-focus" href={`mailto:${deal.email}`}>Email</a>}
            {deal.phone && <a className="ws-btn ws-btn-sm ws-focus" href={`tel:${deal.phone}`}>Call</a>}
          </div>
        </div>

        <div className={`ws-section ge-glass-box${focus === "proposal" ? " is-focus" : ""}`}>
          <h3 className="ws-h3">Proposal</h3>
          <div className="ge-fields">
            <Field label="Proposal link" wide>
              <input ref={proposalRef} className="ws-input" value={form.proposal_url} onChange={set("proposal_url")} placeholder="https://..." inputMode="url" />
            </Field>
            <Field label="Value (£)"><input className="ws-input" value={form.proposal_value} onChange={set("proposal_value")} inputMode="decimal" placeholder="0" /></Field>
            <Field label="Sent on"><input className="ws-input" type="date" value={form.proposal_sent_at} onChange={set("proposal_sent_at")} /></Field>
          </div>
          <div className="ws-acts">
            {deal.proposal_url && (
              <a className="ws-btn ws-btn-sm ws-focus" href={deal.proposal_url} target="_blank" rel="noreferrer"><Icon name="external" size={12} />Open link</a>
            )}
            {deal.has_proposal_file ? (
              <>
                <a className="ws-btn ws-btn-sm ws-focus" href={`/api/admin/growth-engine/pipeline/${deal.id}/proposal`}>
                  <Icon name="content" size={12} />{deal.proposal_file_name || "Download file"}
                </a>
                <button type="button" className="ws-btn ws-btn-sm ws-btn-quiet ws-focus" onClick={() => void removeFile()}>Remove file</button>
              </>
            ) : null}
            <label className="ws-btn ws-btn-sm ws-focus ge-file">
              <Icon name="plus" size={12} />
              {uploading ? "Uploading…" : deal.has_proposal_file ? "Replace file" : "Attach file"}
              <input ref={fileRef} type="file" className="sr-only" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.webp" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
            </label>
          </div>
        </div>

        <div className={`ws-section ge-glass-box${focus === "follow_up" ? " is-focus" : ""}`}>
          <h3 className="ws-h3">Follow up</h3>
          <div className="ge-fields">
            <Field label="Follow up on"><input ref={followRef} className="ws-input" type="date" value={form.follow_up_at} onChange={set("follow_up_at")} /></Field>
            {(deal.stage === "lost" || form.lost_reason) && (
              <Field label="Why not going ahead">
                <input ref={lostRef} className="ws-input" value={form.lost_reason} onChange={set("lost_reason")} placeholder="Timing, budget..." />
              </Field>
            )}
          </div>
        </div>

        <div className="ws-section">
          <Field label="Notes" wide>
            <textarea className="ws-input ge-notes" value={form.notes} onChange={set("notes")} placeholder="What came up on the call, what they need, next step." rows={5} />
          </Field>
        </div>
      </div>

      <div className="ws-drawer-foot">
        <button type="button" className="ws-btn ws-btn-primary ws-focus" disabled={saving || !dirty} onClick={() => void save()}>
          {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
        </button>
        <button type="button" className={`ws-btn ws-focus ml-auto${confirmDelete ? " ge-danger" : " ws-btn-quiet"}`} onClick={() => void remove()} onBlur={() => setConfirmDelete(false)}>
          {confirmDelete ? "Click again to remove" : "Remove lead"}
        </button>
      </div>
    </dialog>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`ge-field${wide ? " is-wide" : ""}`}>
      <span className="ws-field-l">{label}</span>
      {children}
    </label>
  );
}

function AddLeadDialog({ onClose, onAdded }: { onClose: () => void; onAdded: (deal: PipelineDeal) => void }) {
  const { toast } = useToast();
  const ref = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState({ contact_name: "", business_name: "", email: "", phone: "", appointment_at: "", stage: "call_booked" as PipelineStage });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.contact_name.trim()) return toast("Add a name.", "error");
    setSaving(true);
    try {
      const response = await fetch("/api/admin/growth-engine/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, appointment_at: form.appointment_at ? new Date(form.appointment_at).toISOString() : null }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.deal) throw new Error(data?.error || "The lead could not be added.");
      onAdded(data.deal);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <dialog ref={ref} className="ws-modal ws ge-modal" aria-label="Add lead" onCancel={(e) => { e.preventDefault(); onClose(); }} onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <form onSubmit={submit} className="ws-dialog-body">
        <div>
          <h2 className="ws-dialog-title">Add a lead</h2>
          <p className="ws-caption mt-0.5">For a call booked outside the Growth Engine page. Calendar bookings land on their own.</p>
        </div>
        <div className="ge-fields">
          <Field label="Name" wide><input className="ws-input" value={form.contact_name} onChange={set("contact_name")} autoFocus /></Field>
          <Field label="Business" wide><input className="ws-input" value={form.business_name} onChange={set("business_name")} /></Field>
          <Field label="Email"><input className="ws-input" type="email" value={form.email} onChange={set("email")} /></Field>
          <Field label="Phone"><input className="ws-input" type="tel" value={form.phone} onChange={set("phone")} /></Field>
          <Field label="Call time"><input className="ws-input" type="datetime-local" value={form.appointment_at} onChange={set("appointment_at")} /></Field>
          <Field label="Stage">
            <select className="ws-input" value={form.stage} onChange={set("stage")}>
              {PIPELINE_STAGES.map((s) => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
            </select>
          </Field>
        </div>
        <div className="ws-dialog-foot">
          <button type="button" className="ws-btn ws-focus" onClick={onClose}>Cancel</button>
          <button type="submit" className="ws-btn ws-btn-primary ws-focus" disabled={saving}>{saving ? "Adding…" : "Add lead"}</button>
        </div>
      </form>
    </dialog>
  );
}
