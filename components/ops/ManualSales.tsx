"use client";

import { useRef, useState, type FormEvent } from "react";
import type { readCombinedRevenue } from "@/lib/ops/manual-sales";

type Revenue = Awaited<ReturnType<typeof readCombinedRevenue>>;
const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const dateLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const methodLabel = { bank_transfer: "Bank transfer", cash: "Cash" };

export default function ManualSales({ revenue, busy, setBusy, reload }: {
  revenue: Revenue; busy: boolean; setBusy: (value: boolean) => void; reload: () => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const attempt = useRef<{ payload: string; id: string } | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const amount = String(fields.get("amount")).trim();
    if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(amount)) {
      setMessage("Enter a positive GBP amount with up to two decimal places.");
      return;
    }
    const sale = {
      method: fields.get("method"), paid_on: fields.get("paid_on"),
      amount_pence: Math.round(Number(amount) * 100), reference: String(fields.get("reference")).trim(),
    };
    const payload = JSON.stringify(sale);
    if (attempt.current?.payload !== payload) attempt.current = { payload, id: crypto.randomUUID() };
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/business-overview/manual-sales", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...sale, id: attempt.current.id }),
      });
      if (!response.ok) throw new Error((await response.json()).error || "Could not record the sale.");
      attempt.current = null;
      form.reset();
      setMessage("Sale recorded.");
      try {
        await reload();
      } catch {
        setMessage("Sale recorded. Use Refresh to load the updated figures.");
      }
    } catch (e) {
      setMessage(e instanceof TypeError ? "Could not confirm the sale. Try saving the same entry again." :
        e instanceof Error ? e.message : "Could not record the sale. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-5 border-t pt-4" style={{ borderColor: "var(--lg-track)" }} aria-label="Manual add">
      <h3 className="font-semibold">Manual add</h3>
      <form onSubmit={submit} className="mt-3">
        <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
          <label className="ws-label">Payment method
            <select className="ws-input mt-1" name="method">{Object.entries(methodLabel).map(([key, label]) =>
              <option key={key} value={key}>{label}</option>)}</select>
          </label>
          <label className="ws-label">Amount (£)
            <input className="ws-input mt-1" name="amount" type="number" min="0.01" max="21474836.47" step="0.01" inputMode="decimal" placeholder="0.00" required />
          </label>
          <label className="ws-label">Date received
            <input className="ws-input mt-1" name="paid_on" type="date" max={revenue.today} defaultValue={revenue.today} required />
          </label>
          <label className="ws-label">Reference (optional)
            <input className="ws-input mt-1" name="reference" maxLength={160} placeholder="Invoice or customer reference" />
          </label>
          <button className="ws-btn ws-btn-primary ws-focus justify-self-start" type="submit">Record sale</button>
        </fieldset>
        <p role="status" className="ws-caption mt-2">{message}</p>
      </form>
      {revenue.recentSales.length > 0 && <div className="mt-4">
        <h4 className="lg-metric-l">Recently recorded</h4>
        <ul>{revenue.recentSales.map(sale => <li key={sale.id} className="mt-2 flex items-baseline justify-between gap-3 text-sm">
          <span className="min-w-0 break-words">{methodLabel[sale.method]} · {dateLabel.format(new Date(sale.paid_on + "T12:00:00Z"))}
            {sale.reference && <span className="ws-caption block">{sale.reference}</span>}
          </span>
          <strong>{money.format(sale.amount_pence / 100)}</strong>
        </li>)}</ul>
      </div>}
    </section>
  );
}
