# Check-in persistence repair — 15 October 2026

Implemented from the verified deployed/main revision `a77861e40de6d8fdc514612633b99d1548a212f4`, on branch `codex/marc-checkin-save-repair` in `/Users/kevinharkin/Codex-Worktrees/marc-checkin-save-repair`. This is a local application fix, not a production release. No real client records, webinars, reminders or messages were changed.

The old endpoint could ignore a latest-week read failure, collide with an old week and return success without saving the new answers. The form accepted any successful HTTP status and lost unsent answers on reload. Those defects are reproduced in the 14 October diagnosis, but the exact historical cause of Ryan's/Brian's attempts is still unproven. Brian's retry was saved; Ryan's latest recorded check-in remained 25 September at the last production read.

## Implemented behaviour

- A service-role-only RPC locks the active client profile, checks the exact submission ID/content, allocates the next week and saves the check-in plus profile activity timestamp in one transaction. Retries return the original receipt; failures cannot become duplicate-success responses.
- The server checks every database read, validates the configured answers and returns a persisted ID/week/timestamp. An account change cannot submit another account's open draft. Existing forms without an ID still receive an atomic save, although they cannot deduplicate a lost-response retry.
- The form saves account-scoped drafts, restores pending IDs/content after reload/sign-in, freezes uncertain submissions for safe retry, prevents overlapping clicks, requires a matching saved receipt and shows the saved date/link. Errors persist with a sign-in action where appropriate. Blocked storage is surfaced explicitly.
- Other explanations, required text, choice values and scales use shared validation; progress no longer treats incomplete Other answers as complete.
- Browser Web Locks prevent simultaneous editing of an account draft where supported; storage value checks also reject stale writes and receipt cleanup. Another tab's draft is never deliberately cleared. Ordinary drafts restore for 30 days; unresolved attempts retain their ID until reconciled. Draft storage remains local to the authenticated account and origin, including across logout; accounts do not share a key.
- If current validation rejects an uncertain attempt, the same transaction either returns the already-saved receipt or retires that ID in `cancelled_checkin_submissions`. Retired IDs cannot later be saved by an earlier in-flight request. The browser preserves the answers, loads the current questions and uses a new ID for correction.

## Verification

- All 74 tests passed before the final review correction. The final affected suite passed **42 checks** across shared validation/drafts, the actual API route with synthetic auth/DB boundaries, and the actual submit handler with controlled fetch/storage boundaries.
- `python3 scripts/test-checkin-save.py`: **14 PostgreSQL checks** against repository base/v2/v3/lifecycle schema and RLS, local auth stubs and synthetic clients. Includes 12 identical concurrent retries, 12 distinct submissions, content/client conflicts, rollback on profile update failure, archived/missing clients, browser-role denial, cancellation and 12 cancellation/save races. [Proof](database-proof.json). The owned database exited and temporary files were removed.
- Targeted ESLint passes with two harmless unused mock-parameter warnings; production build passes. Standalone `tsc --noEmit` also includes an existing `tests/webinar.test.ts:23` nullability error, present unchanged on the baseline. Next's production typecheck succeeds.
- Structured Sol 6.1/high review accepted three findings: validation could keep a pending draft locked; configuration-dependent mood rewriting could prevent an exact retry; a rejected browser lock could hang loading. Atomic retirement/reconciliation, frozen request mood and a tested actionable lock-error path address these. Final review exited 0 with no accepted/actionable findings; [structured result](review.json). Command: `autoreview --mode local --model gpt-6.1-sol --thinking high` (run from the physical worktree path).
- Mounted/mobile/desktop browser QA remains outstanding. The task-owned in-app tab opened before the isolated fixture server was listening. Binding the resulting browser-generated `data:` error page was then blocked by Browser Use URL policy, including normal close recovery. No policy bypass, alternate automation technology or foreground browser was used. The isolated fixture server was stopped (PID 42105, exit verified). At the last inventory, owned IAB tab `1`, provider `browser-use:bd582817-cf53-4b68-8a59-62faa55d7140`, browser `2`, remained on the error page; normal API closure was blocked. No separate browser/controller process was launched by the task.

## Rollout and remaining verification

1. Complete mounted form checks on a permitted nonproduction/demo environment: restored draft, session expiry/re-login, lost reply/retry, changed-question recovery, blocked storage, second tab and mobile/desktop layout. Verify the saved check-in appears in the client's saved record and Marc's admin view.
2. Apply `supabase/migrations/20261015100000_atomic_checkin_submission.sql` before deploying the application. It adds the cancellation marker table and the service-only RPC; it does not rewrite existing check-ins or profiles.
3. Deploy the reviewed API/form commit. Verify a permitted demo submission and admin visibility before considering the production fix complete. Do not test by overwriting a real client's answers.
4. The additive migration can remain if an application release is paused. Do not restore the known duplicate-success path as routine recovery; investigate or temporarily fail saves explicitly with drafts preserved. Keep retirement markers while any pending/in-flight ID could still be retried.

No production migration, deployment, merge, client notification or contact request is included in this handover. The next decision is rollout after the remaining browser/demo checks.
