# Phased V2 Implementation Roadmap

## Phase 1 — Safe wow-factor release

Implement the complete scope in [03-safe-wow-release.md](./03-safe-wow-release.md).

Primary outcomes:

- The portal still looks and feels like Construction Business Blueprint.
- The shell, dashboard and Business Plan look materially more premium.
- Mobile feels deliberately designed.
- Existing functionality and data behaviour remain unchanged.

Release this phase independently after functional regression and visual QA.

## Phase 2 — Reliability and trust

Implement the functional fixes that require deeper verification:

- Resolve the live hydration mismatch.
- Harden action-item persistence and server reconciliation.
- Harden PDF retention and refresh behaviour.
- Add plan action and PDF regression tests.
- Eliminate silent failures and add retry paths.
- Improve session-expiry handling.
- Add application error monitoring and useful server logging.
- Review and harden document/attachment privacy and authorized delivery.

This phase should be intentionally separate from the large visual diff so any behaviour change is easier to audit and roll back.

## Phase 3 — Core workflow depth

- Business Plan admin autosave or draft recovery.
- PDF replacement/version history.
- Check-In autosave and improved history.
- Monthly Scorecard entry/view separation and chart improvements.
- Inbox sending, retry, draft and attachment improvements.
- Calendar Add to Calendar and clearer history.
- Blueprint AI state persistence and context improvements where supported.

Terminology and coaching processes remain unchanged.

## Phase 4 — Admin productivity

- Enhanced client search, sorting and filtering.
- Improved client detail hierarchy.
- Stronger archive/reactivate/export presentation.
- Better plan editing efficiency and reordering.
- Improved Check-In review flow.
- Improved training administration and preview.
- Operating-brief filtering and predictable dismiss/snooze behaviour.
- Audit history for important admin actions.

## Phase 5 — Final platform polish

- Complete optional light-theme token refactor while keeping dark as default.
- PWA install, update, offline and reconnection refinements.
- Performance and bundle work.
- Full accessibility pass.
- Cross-browser testing.
- Physical iPhone and iPad verification.
- Final production readiness and controlled rollout.

## Implementation rule

Each phase should produce an independently deployable change set. Visual refactoring, database changes, storage/security changes and business-logic changes should not be combined into one difficult-to-audit release unless a dependency makes that unavoidable.
