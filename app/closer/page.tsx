"use client";

import { useState, useEffect, FormEvent } from "react";
import { loadStripe, Stripe, StripeElements } from "@stripe/stripe-js";

const PRODUCTS = [
  { label: "6 Month", price: 5000 },
  { label: "12 Month", price: 8000 },
];

const VAT_RATE = 0.2;

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

export default function CloserPage() {
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [includeVat, setIncludeVat] = useState(true);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [description, setDescription] = useState("");

  const [step, setStep] = useState<"configure" | "payment" | "success" | "error">("configure");
  const [clientSecret, setClientSecret] = useState("");
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [elements, setElements] = useState<StripeElements | null>(null);
  const [cardReady, setCardReady] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Base amount in pounds
  const baseAmount = selectedProduct !== null ? PRODUCTS[selectedProduct].price : Number(customAmount) || 0;
  const vatAmount = includeVat ? baseAmount * VAT_RATE : 0;
  const totalAmount = baseAmount + vatAmount;
  const totalPence = Math.round(totalAmount * 100);

  // Load stripe instance
  useEffect(() => {
    if (stripePromise) {
      stripePromise.then(setStripe);
    }
  }, []);

  // Mount card element when we have a client secret
  useEffect(() => {
    if (!clientSecret || clientSecret === "demo_mode" || !stripe) return;

    const el = stripe.elements({
      clientSecret,
      appearance: {
        theme: "night",
        variables: {
          colorPrimary: "#2272DE",
          colorBackground: "#0c0c12",
          colorText: "#f0f0f5",
          colorTextSecondary: "#8a8ea0",
          colorDanger: "#ef4444",
          borderRadius: "10px",
          fontFamily: "Inter, -apple-system, sans-serif",
        },
        rules: {
          ".Input": {
            border: "1px solid rgba(255,255,255,0.08)",
            backgroundColor: "#08080c",
          },
          ".Input:focus": {
            border: "1px solid rgba(34,114,222,0.5)",
            boxShadow: "0 0 0 3px rgba(34,114,222,0.1)",
          },
        },
      },
    });
    setElements(el);

    const paymentElement = el.create("payment");
    const container = document.getElementById("payment-element");
    if (container) {
      paymentElement.mount(container);
      paymentElement.on("ready", () => setCardReady(true));
    }

    return () => {
      paymentElement.unmount();
    };
  }, [clientSecret, stripe]);

  async function handleGenerate(e: FormEvent) {
    e.preventDefault();
    if (totalAmount < 1) return;

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: totalPence,
          description: description || `CBB ${selectedProduct !== null ? PRODUCTS[selectedProduct].label : "Custom"} - ${customerName}`,
          customerEmail,
          customerName,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setClientSecret(data.clientSecret);
      setIsDemo(data.demo);
      setStep("payment");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create payment");
    } finally {
      setLoading(false);
    }
  }

  async function handlePay() {
    if (isDemo) {
      setStep("success");
      return;
    }

    if (!stripe || !elements) return;

    setProcessing(true);
    setErrorMsg("");

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          receipt_email: customerEmail || undefined,
        },
        redirect: "if_required",
      });

      if (error) {
        setErrorMsg(error.message || "Payment failed");
      } else {
        setStep("success");
      }
    } catch {
      setErrorMsg("Payment failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  }

  function handleReset() {
    setStep("configure");
    setClientSecret("");
    setIsDemo(false);
    setSelectedProduct(null);
    setCustomAmount("");
    setCustomerName("");
    setCustomerEmail("");
    setDescription("");
    setIncludeVat(true);
    setCardReady(false);
    setErrorMsg("");
    setElements(null);
  }

  return (
    <main className="min-h-screen flex items-center justify-center py-12 px-6 relative">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 50% 30%, rgba(34,114,222,0.06) 0%, transparent 60%)",
        }}
      />

      <div className="max-w-[520px] mx-auto w-full relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/cbb-logo.png" alt="CBB" width={48} height={48} className="h-12 w-auto" />
        </div>

        {/* Demo banner */}
        {!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY && (
          <div className="mb-4 bg-[rgba(234,179,8,0.1)] border border-[rgba(234,179,8,0.3)] rounded-xl px-4 py-3 text-center text-[0.85rem] text-yellow-400">
            DEMO MODE - No Stripe keys configured. Payments are simulated.
          </div>
        )}

        {/* Card */}
        <div className="bg-bg-card border border-[rgba(255,255,255,0.06)] rounded-[20px] overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.4),0_0_60px_rgba(34,114,222,0.04)] relative">
          <div className="absolute -top-px left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-[rgba(34,114,222,0.4)] to-transparent" />

          <div className="p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="font-heading text-[1.4rem] font-bold tracking-[-0.5px]">Payment Terminal</h1>
                <p className="text-text-muted text-[0.8rem] mt-0.5">Construction Business Blueprint</p>
              </div>
              <div className="inline-flex items-center gap-2 bg-[rgba(34,114,222,0.08)] border border-[rgba(34,114,222,0.2)] rounded-full px-3 py-1.5 text-[0.7rem] font-semibold text-accent-bright tracking-[0.5px] uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent)]" />
                {step === "success" ? "Paid" : "Live"}
              </div>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.06)] to-transparent mb-6" />

            {/* STEP 1: Configure */}
            {step === "configure" && (
              <form onSubmit={handleGenerate}>
                {/* Product quick-select */}
                <label className="block text-[0.78rem] font-semibold text-text-secondary tracking-wide uppercase mb-2.5">
                  Programme
                </label>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {PRODUCTS.map((p, i) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => { setSelectedProduct(i); setCustomAmount(""); }}
                      className={`py-3.5 px-4 rounded-xl border text-center transition-all cursor-pointer ${
                        selectedProduct === i
                          ? "border-accent bg-[rgba(34,114,222,0.1)] text-white"
                          : "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] text-text-secondary hover:border-[rgba(255,255,255,0.12)]"
                      }`}
                    >
                      <div className="font-heading font-bold text-[1.1rem] tracking-[-0.5px]">
                        {p.label}
                      </div>
                      <div className="text-[0.8rem] text-text-muted mt-0.5">
                        {"\u00A3"}{p.price.toLocaleString()}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Custom amount */}
                <label className="block text-[0.78rem] font-semibold text-text-secondary tracking-wide uppercase mb-2.5">
                  Or custom amount
                </label>
                <div className="relative mb-5">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-semibold">{"\u00A3"}</span>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="0.00"
                    value={customAmount}
                    onChange={(e) => { setCustomAmount(e.target.value); setSelectedProduct(null); }}
                    className="w-full bg-[#08080c] border border-[rgba(255,255,255,0.08)] rounded-xl py-3.5 pl-9 pr-4 text-white text-[1.05rem] font-semibold placeholder:text-text-muted focus:outline-none focus:border-[rgba(34,114,222,0.5)] focus:shadow-[0_0_0_3px_rgba(34,114,222,0.1)] transition-all"
                  />
                </div>

                {/* VAT toggle */}
                <div className="flex items-center justify-between bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3.5 mb-5">
                  <div>
                    <span className="text-[0.9rem] font-medium text-text-primary">Include VAT</span>
                    <span className="text-text-muted text-[0.8rem] ml-2">(20%)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIncludeVat(!includeVat)}
                    className={`w-12 h-7 rounded-full transition-all relative cursor-pointer ${
                      includeVat ? "bg-accent" : "bg-[rgba(255,255,255,0.1)]"
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-md ${
                        includeVat ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>

                {/* Price summary */}
                {baseAmount > 0 && (
                  <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3.5 mb-5 space-y-1.5">
                    <div className="flex justify-between text-[0.85rem]">
                      <span className="text-text-secondary">Subtotal</span>
                      <span className="text-text-primary font-medium">{"\u00A3"}{baseAmount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</span>
                    </div>
                    {includeVat && (
                      <div className="flex justify-between text-[0.85rem]">
                        <span className="text-text-secondary">VAT (20%)</span>
                        <span className="text-text-primary font-medium">{"\u00A3"}{vatAmount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="h-px bg-[rgba(255,255,255,0.06)] my-1" />
                    <div className="flex justify-between">
                      <span className="text-text-primary font-semibold">Total</span>
                      <span className="text-white font-heading font-bold text-[1.3rem] tracking-[-0.5px]">{"\u00A3"}{totalAmount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                )}

                {/* Customer details */}
                <label className="block text-[0.78rem] font-semibold text-text-secondary tracking-wide uppercase mb-2.5">
                  Client details
                </label>
                <div className="space-y-3 mb-5">
                  <input
                    type="text"
                    placeholder="Client name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                    className="w-full bg-[#08080c] border border-[rgba(255,255,255,0.08)] rounded-xl py-3.5 px-4 text-white placeholder:text-text-muted focus:outline-none focus:border-[rgba(34,114,222,0.5)] focus:shadow-[0_0_0_3px_rgba(34,114,222,0.1)] transition-all"
                  />
                  <input
                    type="email"
                    placeholder="Client email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    required
                    className="w-full bg-[#08080c] border border-[rgba(255,255,255,0.08)] rounded-xl py-3.5 px-4 text-white placeholder:text-text-muted focus:outline-none focus:border-[rgba(34,114,222,0.5)] focus:shadow-[0_0_0_3px_rgba(34,114,222,0.1)] transition-all"
                  />
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-[#08080c] border border-[rgba(255,255,255,0.08)] rounded-xl py-3.5 px-4 text-white placeholder:text-text-muted focus:outline-none focus:border-[rgba(34,114,222,0.5)] focus:shadow-[0_0_0_3px_rgba(34,114,222,0.1)] transition-all"
                  />
                </div>

                {errorMsg && (
                  <div className="mb-4 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] rounded-xl px-4 py-3 text-[0.85rem] text-red-400">
                    {errorMsg}
                  </div>
                )}

                {/* Generate button */}
                <button
                  type="submit"
                  disabled={totalAmount < 1 || loading}
                  className="w-full gradient-accent text-white font-semibold py-4 px-8 rounded-xl text-[1.05rem] tracking-[-0.2px] transition-all hover:shadow-[0_0_30px_rgba(34,114,222,0.3)] hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100 disabled:hover:shadow-none cursor-pointer disabled:cursor-not-allowed"
                >
                  {loading ? "Generating..." : `Charge ${"\u00A3"}${totalAmount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`}
                </button>
              </form>
            )}

            {/* STEP 2: Payment */}
            {step === "payment" && (
              <div>
                {/* Summary */}
                <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3.5 mb-5">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-text-primary font-medium text-[0.9rem]">{customerName}</p>
                      <p className="text-text-muted text-[0.8rem]">{customerEmail}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-heading font-bold text-[1.5rem] tracking-[-0.5px]">{"\u00A3"}{totalAmount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</p>
                      <p className="text-text-muted text-[0.75rem]">{includeVat ? "inc. VAT" : "no VAT"}</p>
                    </div>
                  </div>
                </div>

                {/* Card element or demo */}
                {isDemo ? (
                  <div className="bg-[#08080c] border border-[rgba(255,255,255,0.08)] rounded-xl p-5 mb-5">
                    <div className="space-y-3">
                      <div className="h-11 bg-[rgba(255,255,255,0.04)] rounded-lg border border-[rgba(255,255,255,0.06)] flex items-center px-4">
                        <span className="text-text-muted text-[0.85rem]">4242 4242 4242 4242</span>
                        <span className="text-text-muted text-[0.8rem] ml-auto">12/28 &nbsp; 123</span>
                      </div>
                      <p className="text-yellow-400/70 text-[0.75rem] text-center">Demo mode - no real charge</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#08080c] border border-[rgba(255,255,255,0.08)] rounded-xl p-5 mb-5">
                    <div id="payment-element" />
                    {!cardReady && (
                      <div className="text-center text-text-muted text-[0.85rem] py-4">Loading payment form...</div>
                    )}
                  </div>
                )}

                {errorMsg && (
                  <div className="mb-4 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] rounded-xl px-4 py-3 text-[0.85rem] text-red-400">
                    {errorMsg}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setStep("configure"); setClientSecret(""); setCardReady(false); setElements(null); setErrorMsg(""); }}
                    className="py-4 px-6 rounded-xl border border-[rgba(255,255,255,0.08)] text-text-secondary font-medium hover:border-[rgba(255,255,255,0.15)] transition-all cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handlePay}
                    disabled={(!isDemo && !cardReady) || processing}
                    className="flex-1 gradient-accent text-white font-semibold py-4 px-8 rounded-xl text-[1.05rem] tracking-[-0.2px] transition-all hover:shadow-[0_0_30px_rgba(34,114,222,0.3)] hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {processing ? "Processing..." : `Confirm Payment`}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Success */}
            {step === "success" && (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.3)] flex items-center justify-center mx-auto mb-5">
                  <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="font-heading text-[1.5rem] font-bold tracking-[-0.5px] mb-2">Payment Successful</h2>
                <p className="text-text-secondary text-[0.9rem] mb-1">
                  {"\u00A3"}{totalAmount.toLocaleString("en-GB", { minimumFractionDigits: 2 })} charged to {customerName}
                </p>
                <p className="text-text-muted text-[0.8rem] mb-8">
                  Receipt sent to {customerEmail}
                </p>
                <button
                  type="button"
                  onClick={handleReset}
                  className="gradient-accent text-white font-semibold py-3.5 px-8 rounded-xl transition-all hover:shadow-[0_0_30px_rgba(34,114,222,0.3)] hover:scale-[1.02] cursor-pointer"
                >
                  New Payment
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="text-text-muted text-[0.7rem] text-center mt-4">
          Payments processed securely via Stripe
        </p>
      </div>
    </main>
  );
}
