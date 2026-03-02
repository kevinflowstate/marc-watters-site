"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [goals, setGoals] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from("users")
        .select("full_name")
        .eq("id", user.id)
        .single();

      const { data: profile } = await supabase
        .from("client_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (userData) setFullName(userData.full_name || "");
      if (profile) {
        setPhone(profile.phone || "");
        setBusinessName(profile.business_name || "");
        setBusinessType(profile.business_type || "");
        setGoals(profile.goals || "");
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("users").update({ full_name: fullName }).eq("id", user.id);

    await supabase
      .from("client_profiles")
      .update({ phone, business_name: businessName, business_type: businessType, goals })
      .eq("user_id", user.id);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) return <div className="text-text-muted">Loading...</div>;

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-text-primary">Settings</h1>
        <p className="text-text-secondary mt-1">Update your profile information.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-heading font-bold text-text-primary">Profile</h2>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>
        </div>

        <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-heading font-bold text-text-primary">Business Details</h2>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Business Name</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Business Type</label>
            <input
              type="text"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              placeholder="e.g. Plumbing, Electrical, Construction"
              className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Goals</label>
            <textarea
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              rows={3}
              placeholder="What are you looking to achieve?"
              className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 gradient-accent text-white rounded-xl text-sm font-semibold disabled:opacity-40 transition-opacity"
          >
            {saving ? "Saving..." : saved ? "Saved" : "Save Changes"}
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            className="px-6 py-3 text-sm text-red-400 hover:text-red-300 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </form>
    </div>
  );
}
