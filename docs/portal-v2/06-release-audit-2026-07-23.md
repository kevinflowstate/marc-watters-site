# Product Release Audit — 23 July 2026

## Release identity

- Branch: `codex/portal-v2-training-ai-settings`
- Production-matching base commit: `88fc38d`
- Preview deployment: `dpl_6Jnv4dC6Uj6RD8HuGPzx8pksjoVx`
- Preview URL: <https://marc-watters-site-c8ojmqchy-kevinflowstate-7682s-projects.vercel.app>
- Preview state: `READY`
- Preview target: `preview`
- Production deployment: not performed

### Preview configuration correction — 24 July 2026

The first preview deployment returned a middleware 500 because the required Supabase variables existed for Production and one older branch-specific preview, but not for an unscoped CLI preview. A replacement preview was built with the minimum required Supabase and Blueprint AI configuration attached directly to that deployment. No project-wide Preview variables or Production settings were changed.

### Preview verification follow-up — 24 July 2026

- The first V2 light-mode pass retained dark V2 surface variables while inheriting dark light-mode foregrounds. The V2 shell now defines paired light surfaces, borders, shadows and foreground tokens. Training artwork remains intentionally dark with a protected white title treatment.
- Settings, Training and Blueprint AI were visually rechecked in light mode at 1440px and 390px. No horizontal overflow was found, and dark-mode tokens remain unchanged.
- Blueprint AI initially received `authentication_error: API key is invalid.` Production logs and a successful live phone test confirmed the Production key itself was healthy. The CLI environment download had appended one trailing newline while preparing the one-off preview value. The AI route now uses the project’s existing environment normalizer, which removes that transport whitespace before calling Anthropic.

## Verdict

**READY FOR GUIDED CLIENT TESTING**

The intended Training, Blueprint AI and Settings upgrades are implemented, reviewed and passing deterministic local regression checks. The exact working tree also builds successfully in the Vercel preview environment. Production should remain unchanged until an authenticated user has completed the guided preview checks listed below.

## Release scope

Runtime changes are limited to:

- `app/portal/training/page.tsx`
- `app/portal/training/[id]/page.tsx`
- `components/training/ModuleCover.tsx`
- `app/portal/ai/page.tsx`
- `app/portal/settings/page.tsx`

Documentation changes are limited to this `docs/portal-v2` roadmap and audit folder.

There are no database migrations, schema changes, middleware changes, API contract changes, environment-variable changes or authentication changes in this batch.

## Verification coverage

### Automated and static checks

- `npm test`: 3/3 tests passed
- `npx tsc --noEmit`: passed
- `npm run build`: passed locally; 94 routes generated
- Vercel preview build: passed and reached `READY`
- `npm run lint`: 0 errors; 13 pre-existing warnings outside the five changed runtime files
- Focused lint of all five changed runtime files: 0 errors and 0 warnings
- `git diff --check`: passed

### Golden journeys

All 11 deterministic changed-route journeys passed using a controlled client fixture:

1. Training library loading and module presentation
2. Training search and category filtering
3. Module navigation and detail-page presentation
4. Lesson expansion, video links and resources
5. Training failure state without a conflicting empty state
6. Blueprint AI prompt submission and semantic response rendering
7. Blueprint AI rate-limit/error handling and retry
8. Blueprint AI cancellation and New conversation stale-response protection
9. Settings profile form and save payload
10. Settings password validation and first-time setup state
11. Settings navigation, notification states, sign-out presentation and responsive behaviour

### Responsive and accessibility checks

- Viewports checked: 1440px, 768px, 390px and 320px
- No horizontal overflow found on the changed routes
- Training cover SVG IDs are unique
- Decorative cover titles are hidden from assistive technology
- AI bullet responses expose real heading and list semantics
- Settings sections and forms have explicit accessible labels
- Normal fixture journeys produced no console or hydration errors

## Findings resolved during the audit

### P2 — Blueprint AI stale response race

An in-flight response could repopulate the conversation after the user selected New conversation. Requests now use cancellation and request identity checks; cancelled or superseded responses are ignored.

### P2 — Settings password validation bypass

Password constraints previously depended too heavily on the disabled submit button. The submit handler now independently validates minimum length and matching passwords.

### P2 — Settings setup URL persistence

A successful first-time password setup could leave the setup query parameter in the URL and re-enter setup mode on refresh. The URL is now replaced with the standard Settings route after success.

### P2 — Training error and empty states

A failed Training request could show both the load error and the empty-library message. The states are now mutually exclusive.

### Quality and accessibility improvements

- Memoized Training module metadata removes repeated indexing and duration calculations.
- The AI assistant response is isolated in a memoized component and renders semantic lists and headings.
- Module imagery uses `next/image`.
- Settings section labelling and notification-state readability were simplified.

## Residual risk and guided checks

The following require a real authenticated preview session and were deliberately not simulated against live client data:

1. Sign in as a normal client and confirm Training, Blueprint AI and Settings permissions.
2. Save a reversible profile edit, refresh, and confirm persistence.
3. Submit a real Blueprint AI prompt and confirm the configured external service responds.
4. If password setup is relevant to the test account, complete it and sign in again.
5. Check the changed routes on a physical iPhone or iPad.
6. If push notifications are used, verify the real browser permission and subscription flow.
7. Complete one successful Blueprint AI conversation on the corrected preview.

No real client records, passwords, push subscriptions or production data were changed during this audit. All local fixture files and temporary middleware allowances were removed after testing.

The equivalent admin AI renderer was reviewed for potential reuse but intentionally left unchanged so this release does not expand into an unrequested admin-route refactor.

## Recommended production procedure

After guided preview approval:

1. Re-run the static checks against the final diff.
2. Commit only the five runtime files and `docs/portal-v2`.
3. Push the exact reviewed commit.
4. Deploy that commit to production.
5. Smoke-test Training, Blueprint AI and Settings on both production domains without mutating client data.
