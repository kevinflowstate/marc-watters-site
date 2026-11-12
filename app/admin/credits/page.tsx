"use client";

import { useState, useEffect } from "react";
import { initials } from "@/lib/initials";
import { Chip, Empty, Icon, SkeletonRows } from "@/components/ops/workspace/WorkspaceUI";

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
      <div className="ws ws-page">
        <div>
          <span className="ws-skel" style={{ width: 140, height: 22 }} />
          <span className="ws-skel mt-2" style={{ width: 260, height: 12 }} />
        </div>
        <div className="ws-panel"><SkeletonRows count={4} /></div>
      </div>
    );
  }

  const totalCredits = clients.reduce((sum, c) => sum + (c.ai_credits || 0), 0);

  return (
    <div className="ws ws-page">
      <div className="ws-ph">
        <div className="min-w-0">
          <h1 className="ws-title">AI credits</h1>
          <p className="ws-meta mt-1">
            {clients.length} clients - {formatCredits(totalCredits)} total credits outstanding
          </p>
        </div>
      </div>

      <div className="ws-pair">
        {/* Client credits list */}
        <section className="ws-panel" aria-label="Credit balances">
          <header className="ws-panel-head">
            <h2 className="ws-h2">Credit balances</h2>
            <span className="ws-caption">{clients.length}</span>
          </header>
          <div>
          {clients.length === 0 && (
            <Empty icon="users" title="No clients found." />
          )}
          {clients.map((client) => {
            const user = Array.isArray(client.user) ? client.user[0] : client.user;
            const credits = client.ai_credits || 0;
            const isLow = credits < 500; // under £5.00
            const isSelected = detailUserId === client.user_id;

            return (
              <div
                key={client.id}
                className={`ws-cr-row ${isSelected ? "is-on" : ""}`}
                onClick={() => loadDetail(client.user_id)}
              >
                <span className="ws-avatar is-md" aria-hidden="true">
                  {initials((user as { full_name: string } | null)?.full_name || "Unknown")}
                </span>
                <div className="min-w-0">
                  <div className="ws-cr-name">
                    <p className="ws-row-title">
                      {(user as { full_name: string } | null)?.full_name || "Unknown"}
                    </p>
                    {isLow && (
                      <Chip tone="attn">
                        Low
                      </Chip>
                    )}
                  </div>
                  <p className="ws-row-sub">
                    {client.business_name || (user as { email: string } | null)?.email || "-"}
                  </p>
                </div>
                <div className="ws-cr-right">
                  <div className="ws-cr-bal">
                    <p className={`ws-cr-amt ${credits === 0 ? "is-bad" : isLow ? "is-attn" : "is-ok"}`}>
                      {formatCredits(credits)}
                    </p>
                    <p className="ws-cr-cap">balance</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTopUpModal(client);
                      setTopUpAmount("");
                      setTopUpMessage(null);
                    }}
                    className="ws-btn ws-btn-sm ws-focus"
                  >
                    Top up
                  </button>
                </div>
              </div>
            );
          })}
          </div>
        </section>

        {/* Usage detail panel */}
        <section className="ws-panel" aria-label="Usage detail">
          <header className="ws-panel-head">
            <h2 className="ws-h2">Usage detail</h2>
          </header>
          <div>
          {!detailUserId && (
            <Empty icon="reporting" title="Select a client to view usage history" />
          )}
          {detailUserId && detailLoading && (
            <div className="ws-cr-pad">
              <span className="ws-skel" style={{ width: 128, height: 12 }} />
              <div className="ws-cr-grid">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="ws-cr-cell">
                    <span className="ws-skel" style={{ width: 60, height: 10 }} />
                    <span className="ws-skel" style={{ width: 44, height: 18 }} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {detailUserId && !detailLoading && detailData && (
            <div>
              <div className="ws-cr-who">
                <p className="ws-row-title">
                  {(Array.isArray(detailData.profile.user) ? detailData.profile.user[0] : detailData.profile.user as { full_name: string } | null)?.full_name || "Unknown"}
                </p>
                <p className="ws-row-sub">{detailData.profile.business_name || "-"}</p>
              </div>

              <div className="ws-group">Last 30 days</div>
              <div className="ws-cr-grid">
                <div className="ws-cr-cell">
                  <p className="ws-cr-l">Requests</p>
                  <p className="ws-cr-n">{detailData.usage.last30Days.totalRequests}</p>
                </div>
                <div className="ws-cr-cell">
                  <p className="ws-cr-l">Billed</p>
                  <p className="ws-cr-n">
                    {formatCredits(detailData.usage.last30Days.totalBilledPence)}
                  </p>
                </div>
                <div className="ws-cr-cell">
                  <p className="ws-cr-l">Input tokens</p>
                  <p className="ws-cr-n">
                    {detailData.usage.last30Days.totalInputTokens.toLocaleString()}
                  </p>
                </div>
                <div className="ws-cr-cell">
                  <p className="ws-cr-l">Output tokens</p>
                  <p className="ws-cr-n">
                    {detailData.usage.last30Days.totalOutputTokens.toLocaleString()}
                  </p>
                </div>
              </div>

              {detailData.usage.recent.length > 0 && (
                <>
                  <div className="ws-group">Recent requests</div>
                  <div className="ws-cr-recent">
                    {detailData.usage.recent.map((entry, i) => (
                      <div key={i} className="ws-cr-req">
                        <div className="min-w-0">
                          <p className="ws-cr-req-t">
                            {entry.input_tokens.toLocaleString()} in / {entry.output_tokens.toLocaleString()} out
                          </p>
                          <p className="ws-caption">{timeAgo(entry.created_at)}</p>
                        </div>
                        <span className="ws-cr-req-n">
                          {formatCredits(Number(entry.billed_cost_pence))}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {detailData.usage.recent.length === 0 && (
                <p className="ws-caption ws-cr-none">No usage in the last 30 days</p>
              )}
            </div>
          )}
          </div>
        </section>
      </div>

      {/* Top Up Modal */}
      {topUpModal && (
        <div className="ws-overlay">
          <div className="ws-overlay-bg" />
          <div className="ws-dialog" role="dialog" aria-modal="true" aria-label="Top up credits">
            <div className="ws-dialog-head">
              <div className="min-w-0">
                <h3 className="ws-dialog-title">Top up credits</h3>
                <p className="ws-caption mt-0.5">
                  {(Array.isArray(topUpModal.user) ? topUpModal.user[0] : topUpModal.user as { full_name: string } | null)?.full_name || topUpModal.business_name}
                </p>
              </div>
            </div>

            <div className="ws-dialog-body">
            <dl className="ws-kv ws-cr-kv">
              <dt>Current balance</dt>
              <dd>{formatCredits(topUpModal.ai_credits || 0)}</dd>
            </dl>

            {topUpMessage && (
              <div className={`ws-note ${topUpMessage.type === "success" ? "is-ok" : "is-bad"}`} role={topUpMessage.type === "success" ? "status" : "alert"}>
                <Icon name={topUpMessage.type === "success" ? "checkCircle" : "alert"} size={15} />
                <span>
                  {topUpMessage.text}
                </span>
              </div>
            )}

            <form onSubmit={handleTopUp} className="ws-cr-form">
              <div>
                <label className="ws-label" htmlFor="topup-amount">Amount (£)</label>
                <div className="ws-cr-money">
                  <span aria-hidden="true">£</span>
                  <input
                    id="topup-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    placeholder="10.00"
                    className="ws-input"
                    autoFocus
                  />
                </div>
                <div className="ws-cr-presets">
                  {[5, 10, 25, 50].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTopUpAmount(String(preset))}
                      className="ws-btn ws-btn-sm ws-focus"
                    >
                      £{preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ws-dialog-foot">
                <button
                  type="button"
                  onClick={() => { setTopUpModal(null); setTopUpAmount(""); setTopUpMessage(null); }}
                  className="ws-btn ws-btn-quiet ws-focus"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={topping || !topUpAmount.trim()}
                  className="ws-btn ws-btn-primary ws-focus"
                >
                  {topping ? "Adding..." : "Add credits"}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
