export default function LoginPage() {
  return (
    <main className="min-h-screen pt-[120px] pb-20 px-8 flex items-center justify-center">
      <div className="max-w-[400px] w-full">
        <div className="text-center mb-8">
          <h1 className="font-heading text-2xl font-black mb-2">Client Portal</h1>
          <p className="text-text-secondary text-sm">Sign in to access your dashboard</p>
        </div>

        <div className="bg-bg-card border border-[rgba(255,255,255,0.06)] rounded-[20px] p-8">
          <div className="mb-4">
            <label className="block text-sm font-medium text-text-secondary mb-2">Email</label>
            <div className="w-full h-11 bg-bg-primary border border-[rgba(255,255,255,0.04)] rounded-xl" />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-text-secondary mb-2">Password</label>
            <div className="w-full h-11 bg-bg-primary border border-[rgba(255,255,255,0.04)] rounded-xl" />
          </div>
          <div className="w-full h-11 bg-accent rounded-xl flex items-center justify-center text-white font-semibold text-sm cursor-not-allowed opacity-60">
            Sign In (Coming Soon)
          </div>
          <p className="text-center text-text-muted text-xs mt-4">Authentication via Supabase - coming soon</p>
        </div>
      </div>
    </main>
  );
}
