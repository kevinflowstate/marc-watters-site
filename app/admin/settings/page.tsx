"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AdminSettingsPage() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");

  async function createClientAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !fullName.trim()) return;
    setCreating(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/create-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, full_name: fullName }),
      });

      const data = await res.json();
      if (data.error) {
        setMessage(`Error: ${data.error}`);
      } else {
        setMessage(`Client account created for ${email}. They will receive a password reset email.`);
        setEmail("");
        setFullName("");
      }
    } catch {
      setMessage("Failed to create client. Check the console for details.");
    }

    setCreating(false);
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-text-primary">Admin Settings</h1>
        <p className="text-text-secondary mt-1">Manage portal configuration.</p>
      </div>

      {/* Create client */}
      <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-heading font-bold text-text-primary mb-4">Create Client Account</h2>
        <p className="text-text-muted text-sm mb-4">Add a new client to the portal. They will receive an email to set their password.</p>

        <form onSubmit={createClientAccount} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Smith"
              className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@example.com"
              className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40"
            />
          </div>
          <button
            type="submit"
            disabled={creating || !email.trim() || !fullName.trim()}
            className="px-6 py-3 gradient-accent text-white rounded-xl text-sm font-semibold disabled:opacity-40 transition-opacity"
          >
            {creating ? "Creating..." : "Create Client"}
          </button>
        </form>

        {message && (
          <div className={`mt-4 p-3 rounded-xl text-sm ${message.startsWith("Error") ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`}>
            {message}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6">
        <h2 className="text-lg font-heading font-bold text-text-primary mb-4">Portal Info</h2>
        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b border-[rgba(255,255,255,0.04)]">
            <span className="text-sm text-text-muted">Portal URL</span>
            <span className="text-sm text-text-primary">/portal</span>
          </div>
          <div className="flex justify-between py-2 border-b border-[rgba(255,255,255,0.04)]">
            <span className="text-sm text-text-muted">Admin URL</span>
            <span className="text-sm text-text-primary">/admin</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-sm text-text-muted">Authentication</span>
            <span className="text-sm text-text-primary">Supabase Auth (Email/Password)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
