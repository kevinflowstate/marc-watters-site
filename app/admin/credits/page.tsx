"use client";

import { useState, useEffect } from "react";

interface ClientCredit {
  id: string;
  user_id: string;
  ai_credits: number;
  business_name: string;
  user: { full_name: string; email: string } | null;
}

interface UsageSummary {
  last30Days: {
    totalRequests: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalBilledPence: number;
    totalBilledPounds: number;
  };
  recent: Array<{
    input_tokens: number;
    output_tokens: number;
    billed_cost_pence: number;
    created_at: string;
  }>;
}

function formatCredits(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

export default function CreditsPage() {
  const [clients, setClients] = useState<ClientCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [topUpModal, setTopUpModal] = useState<ClientCredit | null>(null);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topping, setTopping] = useState(false);
  const [topUpMessage, setTopUpMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<{ profile: ClientCredit; usage: UsageSummary } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function loadClients() {
    try {
      const res = await fetch("/api/admin/credits");
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadClients(); }, []);

  async function loadDetail(userId: string) {
    setDetailUserId(userId);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const res = await fetch(`/api/admin/credits?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setDetailData(data);
      }
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleTopUp(e: React.FormEvent) {
    e.preventDefault();
    if (!topUpModal || !topUpAmount.trim()) return;
    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount <= 0) return;

    setTopping(true);
    setTopUpMessage(null);
    try {
      const res = await fetch("/api/admin/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: topUpModal.user_id, amount }),
      });
      const data = await res.json();
      if (data.error) {
        setTopUpMessage({ type: "error", text: data.error });
      } else {
        setTopUpMessage({ type: "success", text: `Added £${amount.toFixed(2)}. New balance: ${formatCredits(data.newBalancePence)}` });
        await loadClients();
        if (detailUserId === topUpModal.user_id) {
          await loadDetail(topUpModal.user_id);
        }
        setTimeout(() => {
          setTopUpModal(null);
          setTopUpAmount("");
          setTopUpMessage(null);
        }, 1500);
      }
    } catch {
      setTopUpMessage({ type: "error", text: "Failed to top up credits." });
    }
    setTopping(false);
  }

  if (loading) {
    return (
      <>
        <div className="mb-8">
          <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-8 w-48 mb-2" />
          <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-4 w-64" />
        </div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-bg-card/80 border border-[rgba(255,255,255,0.04)] rounded-2xl p-5">
              <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-4 w-40 mb-2" />
              <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-3 w-56" />
            </div>
          ))}
        </div>
      </>
    );
  }

  const totalCredits = clients.reduce((sum, c) => sum + (c.ai_credits || 0), 0);

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-primary">AI Credits</h1>
          <p className="text-text-secondary mt-1">
            {clients.length} clients - {formatCredits(totalCredits)} total credits outstanding
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Client credits list */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider px-1">Credit Balances</h2>
          {clients.length === 0 && (
            <div className="bg-bg-card/80 border border-[rgba(255,255,255,0.04)] rounded-2xl p-6 text-center text-text-muted text-sm">
              No clients found.
            </div>
          )}
          {clients.map((client) => {
            const user = Array.isArray(client.user) ? client.user[0] : client.user;
            const credits = client.ai_credits || 0;
            const isLow = credits < 500; // under £5.00
            const isSelected = detailUserId === client.user_id;

            return (
              <div
                key={client.id}
                className={`bg-bg-card/80 border rounded-2xl p-5 transition-all cursor-pointer ${
                  isSelected
                    ? "border-[rgba(34,114,222,0.3)] bg-[rgba(34,114,222,0.04)]"
                    : "border-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.08)]"
                }`}
                onClick={() => loadDetail(client.user_id)}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-text-primary truncate">
                        {(user as { full_name: string } | null)?.full_name || "Unknown"}
                      </p>
                      {isLow && (
                        <span className="flex-shrink-0 text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
                          Low
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted mt-0.5 truncate">
                      {client.business_name || (user as { email: string } | null)?.email || "-"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className={`text-base font-bold font-heading ${credits === 0 ? "text-red-400" : isLow ? "text-amber-400" : "text-emerald-400"}`}>
                        {formatCredits(credits)}
                      </p>
                      <p className="text-[10px] text-text-muted">balance</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTopUpModal(client);
                        setTopUpAmount("");
                        setTopUpMessage(null);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold gradient-accent text-white rounded-lg cursor-pointer"
                    >
                      Top Up
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Usage detail panel */}
        <div>
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider px-1 mb-3">Usage Detail</h2>
          {!detailUserId && (
            <div className="bg-bg-card/80 border border-[rgba(255,255,255,0.04)] rounded-2xl p-8 text-center text-text-muted text-sm">
              Select a client to view usage history
            </div>
          )}
          {detailUserId && detailLoading && (
            <div className="bg-bg-card/80 border border-[rgba(255,255,255,0.04)] rounded-2xl p-6 space-y-3">
              <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-4 w-32 mb-4" />
              <div className="grid grid-cols-2 gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-xl h-16" />
                ))}
              </div>
            </div>
          )}
          {detailUserId && !detailLoading && detailData && (
            <div className="bg-bg-card/80 border border-[rgba(255,255,255,0.04)] rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[rgba(255,255,255,0.04)]">
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    {(Array.isArray(detailData.profile.user) ? detailData.profile.user[0] : detailData.profile.user as { full_name: string } | null)?.full_name || "Unknown"}
                  </p>
                  <p className="text-xs text-text-muted">{detailData.profile.business_name || "-"}</p>
                </div>
              </div>

              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Last 30 Days</p>
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-bg-primary/60 border border-[rgba(255,255,255,0.04)] rounded-xl p-3">
                  <p className="text-xs text-text-muted mb-1">Requests</p>
                  <p className="text-lg font-heading font-bold text-text-primary">{detailData.usage.last30Days.totalRequests}</p>
                </div>
                <div className="bg-bg-primary/60 border border-[rgba(255,255,255,0.04)] rounded-xl p-3">
                  <p className="text-xs text-text-muted mb-1">Billed</p>
                  <p className="text-lg font-heading font-bold text-text-primary">
                    {formatCredits(detailData.usage.last30Days.totalBilledPence)}
                  </p>
                </div>
                <div className="bg-bg-primary/60 border border-[rgba(255,255,255,0.04)] rounded-xl p-3">
                  <p className="text-xs text-text-muted mb-1">Input Tokens</p>
                  <p className="text-base font-heading font-bold text-text-primary">
                    {detailData.usage.last30Days.totalInputTokens.toLocaleString()}
                  </p>
                </div>
                <div className="bg-bg-primary/60 border border-[rgba(255,255,255,0.04)] rounded-xl p-3">
                  <p className="text-xs text-text-muted mb-1">Output Tokens</p>
                  <p className="text-base font-heading font-bold text-text-primary">
                    {detailData.usage.last30Days.totalOutputTokens.toLocaleString()}
                  </p>
                </div>
              </div>

              {detailData.usage.recent.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Recent Requests</p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {detailData.usage.recent.map((entry, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-[rgba(255,255,255,0.03)] last:border-0">
                        <div>
                          <p className="text-xs text-text-primary">
                            {entry.input_tokens.toLocaleString()} in / {entry.output_tokens.toLocaleString()} out
                          </p>
                          <p className="text-[10px] text-text-muted">{timeAgo(entry.created_at)}</p>
                        </div>
                        <span className="text-xs font-medium text-text-secondary">
                          {formatCredits(Number(entry.billed_cost_pence))}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {detailData.usage.recent.length === 0 && (
                <p className="text-xs text-text-muted text-center py-4">No usage in the last 30 days</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Top Up Modal */}
      {topUpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-card border border-[rgba(255,255,255,0.08)] rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-heading font-bold text-text-primary">Top Up Credits</h3>
                <p className="text-xs text-text-muted">
                  {(Array.isArray(topUpModal.user) ? topUpModal.user[0] : topUpModal.user as { full_name: string } | null)?.full_name || topUpModal.business_name}
                </p>
              </div>
            </div>

            <div className="bg-bg-primary/60 border border-[rgba(255,255,255,0.04)] rounded-xl px-4 py-3 mb-4">
              <p className="text-xs text-text-muted mb-0.5">Current balance</p>
              <p className="text-base font-heading font-bold text-text-primary">{formatCredits(topUpModal.ai_credits || 0)}</p>
            </div>

            {topUpMessage && (
              <div className={`flex items-center gap-2 rounded-xl px-4 py-3 mb-4 border ${
                topUpMessage.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/20"
                  : "bg-red-500/10 border-red-500/20"
              }`}>
                <span className={`text-sm font-medium ${topUpMessage.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
                  {topUpMessage.text}
                </span>
              </div>
            )}

            <form onSubmit={handleTopUp} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Amount (£)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">£</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    placeholder="10.00"
                    className="w-full pl-7 pr-4 py-2.5 bg-bg-primary border border-[rgba(255,255,255,0.08)] rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-bright/50 transition-colors"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  {[5, 10, 25, 50].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTopUpAmount(String(preset))}
                      className="flex-1 py-1.5 text-xs font-medium text-text-secondary bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-lg hover:border-[rgba(255,255,255,0.12)] hover:text-text-primary transition-colors cursor-pointer"
                    >
                      £{preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setTopUpModal(null); setTopUpAmount(""); setTopUpMessage(null); }}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-text-secondary bg-bg-primary border border-[rgba(255,255,255,0.08)] rounded-xl hover:text-text-primary transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={topping || !topUpAmount.trim()}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-white gradient-accent rounded-xl disabled:opacity-50 cursor-pointer"
                >
                  {topping ? "Adding..." : "Add Credits"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
