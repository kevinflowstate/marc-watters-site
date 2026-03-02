"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { ClientProfile, ClientModule, CheckIn, TrafficLight } from "@/lib/types";

export default function ClientDetailPage() {
  const { id } = useParams();
  const [client, setClient] = useState<ClientProfile & { user?: { full_name: string; email: string } } | null>(null);
  const [modules, setModules] = useState<ClientModule[]>([]);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const [clientRes, modulesRes, checkinsRes] = await Promise.all([
        supabase.from("client_profiles").select("*, user:users(full_name, email)").eq("id", id).single(),
        supabase.from("client_modules").select("*, module:training_modules(title, order_index)").eq("client_id", id),
        supabase.from("checkins").select("*").eq("client_id", id).order("created_at", { ascending: false }),
      ]);

      if (clientRes.data) setClient(clientRes.data);
      if (modulesRes.data) setModules(modulesRes.data);
      if (checkinsRes.data) setCheckins(checkinsRes.data);
      setLoading(false);
    }
    load();
  }, [id]);

  async function updateStatus(status: TrafficLight) {
    const supabase = createClient();
    await supabase.from("client_profiles").update({ status }).eq("id", id);
    setClient((prev) => prev ? { ...prev, status } : null);
  }

  async function submitReply(checkinId: string) {
    const text = replyText[checkinId];
    if (!text?.trim()) return;

    const supabase = createClient();
    await supabase.from("checkins").update({
      admin_reply: text,
      replied_at: new Date().toISOString(),
    }).eq("id", checkinId);

    setCheckins((prev) =>
      prev.map((c) => c.id === checkinId ? { ...c, admin_reply: text, replied_at: new Date().toISOString() } : c)
    );
    setReplyText((prev) => ({ ...prev, [checkinId]: "" }));
  }

  if (loading) return <div className="text-text-muted">Loading client...</div>;
  if (!client) return <div className="text-text-muted">Client not found.</div>;

  const completedModules = modules.filter((m) => m.status === "completed").length;

  return (
    <>
      <Link href="/admin/clients" className="text-text-muted text-sm hover:text-text-secondary transition-colors no-underline inline-flex items-center gap-1 mb-6">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Clients
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-primary">{client.user?.full_name || "Unknown"}</h1>
          <p className="text-text-secondary mt-1">{client.user?.email} {client.phone ? `- ${client.phone}` : ""}</p>
          <p className="text-text-muted text-sm mt-1">{client.business_name} {client.business_type ? `(${client.business_type})` : ""}</p>
        </div>

        {/* Status buttons */}
        <div className="flex gap-2">
          {(["green", "amber", "red"] as const).map((s) => (
            <button
              key={s}
              onClick={() => updateStatus(s)}
              className={`w-8 h-8 rounded-full transition-all ${
                client.status === s
                  ? `${s === "green" ? "bg-emerald-500" : s === "amber" ? "bg-amber-500" : "bg-red-500"} ring-2 ring-offset-2 ring-offset-bg-primary ${s === "green" ? "ring-emerald-500" : s === "amber" ? "ring-amber-500" : "ring-red-500"}`
                  : `${s === "green" ? "bg-emerald-500/20" : s === "amber" ? "bg-amber-500/20" : "bg-red-500/20"} hover:opacity-80`
              }`}
            />
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6">
          <div className="text-text-muted text-xs uppercase tracking-wider mb-2">Progress</div>
          <div className="text-2xl font-heading font-bold text-text-primary">{completedModules}/{modules.length}</div>
          <div className="text-text-secondary text-sm">modules completed</div>
        </div>
        <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6">
          <div className="text-text-muted text-xs uppercase tracking-wider mb-2">Check-Ins</div>
          <div className="text-2xl font-heading font-bold text-text-primary">{checkins.length}</div>
          <div className="text-text-secondary text-sm">total submissions</div>
        </div>
        <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6">
          <div className="text-text-muted text-xs uppercase tracking-wider mb-2">Start Date</div>
          <div className="text-2xl font-heading font-bold text-text-primary">
            {new Date(client.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </div>
        </div>
      </div>

      {/* Notes */}
      {client.goals && (
        <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-heading font-bold text-text-primary mb-2">Goals</h2>
          <p className="text-text-secondary text-sm whitespace-pre-wrap">{client.goals}</p>
        </div>
      )}

      {/* Check-in timeline */}
      <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6">
        <h2 className="text-lg font-heading font-bold text-text-primary mb-4">Check-In History</h2>
        {checkins.length === 0 ? (
          <p className="text-text-muted text-sm">No check-ins submitted yet.</p>
        ) : (
          <div className="space-y-4">
            {checkins.map((c) => (
              <div key={c.id} className="border border-[rgba(255,255,255,0.04)] rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-text-primary">Week {c.week_number}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      c.mood === "great" ? "bg-emerald-500/10 text-emerald-400" :
                      c.mood === "good" ? "bg-blue-500/10 text-blue-400" :
                      c.mood === "okay" ? "bg-amber-500/10 text-amber-400" :
                      "bg-red-500/10 text-red-400"
                    }`}>
                      {c.mood}
                    </span>
                  </div>
                  <span className="text-xs text-text-muted">
                    {new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>

                {c.wins && <div className="mb-2"><span className="text-xs text-emerald-400 font-medium">Wins:</span> <span className="text-sm text-text-secondary">{c.wins}</span></div>}
                {c.challenges && <div className="mb-2"><span className="text-xs text-amber-400 font-medium">Challenges:</span> <span className="text-sm text-text-secondary">{c.challenges}</span></div>}
                {c.questions && <div className="mb-2"><span className="text-xs text-accent-bright font-medium">Questions:</span> <span className="text-sm text-text-secondary">{c.questions}</span></div>}

                {c.admin_reply ? (
                  <div className="mt-3 pl-4 border-l-2 border-accent/30">
                    <div className="text-xs text-accent-bright mb-1">Your reply:</div>
                    <div className="text-sm text-text-secondary">{c.admin_reply}</div>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={replyText[c.id] || ""}
                      onChange={(e) => setReplyText((prev) => ({ ...prev, [c.id]: e.target.value }))}
                      placeholder="Reply to this check-in..."
                      className="flex-1 bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40"
                    />
                    <button
                      onClick={() => submitReply(c.id)}
                      className="px-4 py-2 gradient-accent text-white rounded-lg text-sm font-medium"
                    >
                      Reply
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
