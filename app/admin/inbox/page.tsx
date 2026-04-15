import { Suspense } from "react";

import AdminInboxClient from "@/components/inbox/AdminInboxClient";

export default function AdminInboxPage() {
  return (
    <Suspense fallback={<div className="text-sm text-slate-500">Loading inbox...</div>}>
      <AdminInboxClient />
    </Suspense>
  );
}
