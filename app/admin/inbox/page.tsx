import { Suspense } from "react";

import AdminInboxClient from "@/components/inbox/AdminInboxClient";
import { SkeletonRows } from "@/components/ops/workspace/WorkspaceUI";

export default function AdminInboxPage() {
  return (
    <Suspense fallback={<div className="ws ws-page"><section className="ws-panel" aria-label="Loading inbox"><SkeletonRows count={4} /></section></div>}>
      <AdminInboxClient />
    </Suspense>
  );
}
