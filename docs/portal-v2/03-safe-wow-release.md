# Safe Wow-Factor Release

## Goal

Create an immediately visible V2 transformation while preserving all current functionality, data paths, terminology and business logic.

This release should be recognizable within seconds on login, but it should not require database migrations, API contract changes, permission changes or new client behaviour.

## Selection criteria

Items were prioritized using four questions:

1. Will most clients or Marc see the improvement frequently?
2. Is the visual or usability difference immediately noticeable?
3. Can it be implemented without changing stored data or business rules?
4. Can the old and new behaviour be compared safely on a preview deployment?

Scores use 5 as the highest value or wow factor and 1 as the lowest deployment risk.

| Priority | Upgrade | User value | Wow factor | Deployment risk | Why it belongs first |
| --- | --- | ---: | ---: | ---: | --- |
| 1 | Dark design-system refinement | 5 | 5 | 2 | Changes the perceived quality of every upgraded screen while preserving the brand. |
| 2 | Desktop sidebar, header and mobile navigation polish | 5 | 5 | 2 | Visible on every page and does not need route or permission changes. |
| 3 | Client dashboard hierarchy and responsive composition | 5 | 5 | 2 | The highest-frequency client screen currently has the most obvious card and scrolling problems. |
| 4 | Business Plan client-view polish | 5 | 5 | 2 | The plan is the portal's core value and can be visually transformed without changing its data model. |
| 5 | Admin dashboard visual prioritization | 5 | 4 | 2 | Makes Marc's everyday work substantially easier without changing the operating-brief data source. |
| 6 | Consistent skeleton, empty, error and save-feedback components | 4 | 4 | 1 | Makes the whole product feel deliberate and trustworthy with limited functional exposure. |
| 7 | Mobile spacing, touch targets and safe-area corrections | 5 | 4 | 1 | Removes highly visible friction while leaving business logic untouched. |
| 8 | Contextual install banner and authenticated loading polish | 4 | 4 | 2 | Improves the first viewport and prevents the app from repeatedly feeling like it is restarting. |
| 9 | Calendar and Inbox presentation polish | 4 | 4 | 2 | Frequently used screens can look much better without altering sending or event logic. |
| 10 | Restrained micro-interactions and feedback | 3 | 4 | 1 | Adds premium finish after the hierarchy and responsive work are correct. |

## Exact first-release scope

### A. Shared dark visual foundation

- Introduce CSS variables for existing brand colours and surface levels.
- Normalize typography and increase minimum text sizes.
- Normalize spacing, radii, borders and shadows.
- Create shared Button, IconButton, Surface, Status, Skeleton, EmptyState, InlineError and SaveIndicator components.
- Reduce routine noise, glow and gradient usage without removing the dark Blueprint identity.
- Add consistent focus, hover, pressed and disabled states.

**Safety boundary:** Do not change authentication, themes stored in user profiles, data fetching or form submission.

### B. Existing shell polish

- Refine sidebar proportions, grouping, active state and icon alignment.
- Refine the existing header.
- Correct mobile bottom-nav height, safe-area padding and page bottom padding.
- Improve the existing More treatment without changing route destinations.
- Retain current navigation labels and authorization rules.

**Safety boundary:** Do not rename, add, remove or redirect principal routes.

### C. Client dashboard presentation

- Keep all current data sources and dashboard features.
- Reorder existing sections so This Week, current plan progress, next action and next event appear first.
- Consolidate the current KPI cards into a more compact responsive summary.
- Collapse the Monthly Scorecard entry interface behind an explicit action while retaining the same form.
- Move supporting sections lower and improve empty-state presentation.
- Build a deliberate mobile order instead of using automatic desktop stacking.

**Safety boundary:** Do not change metric calculations, Check-In logic, plan queries or event selection rules.

### D. Business Plan client view

- Improve current phase, progress and action-list hierarchy.
- Give outstanding and completed actions distinct treatments.
- Improve long text, deadline and status wrapping.
- Improve action completion feedback using the existing mutation.
- Improve PDF presentation using the currently returned document URL.
- Add non-invasive loading, empty and error treatments.

**Safety boundary:** Do not change the admin save endpoint, action schema, PDF storage or optimistic-persistence logic in this visual release. Those receive their own tested reliability release.

### E. Admin dashboard presentation

- Keep the existing operating-brief data and actions.
- Group the rendered entries visually by existing urgency or status data where already available.
- Initially show the highest-priority subset and allow expansion.
- Improve action layout and responsive behaviour.
- Move client and recent Check-In summaries higher.

**Safety boundary:** Do not introduce new prioritization algorithms, automated actions or mutation endpoints.

### F. State and responsive polish

- Replace generic large loading panels with page-shaped skeletons.
- Add useful empty states without inventing data.
- Standardize existing errors and retries where the current handler already supports retry.
- Correct mobile overflow, button compression and bottom-nav overlap.
- Improve 1–10 Check-In touch targets without changing values or submission.
- Add restrained transitions with reduced-motion support.

## Explicitly deferred from the first release

These remain valuable, but they carry greater functional, data or security risk and should have isolated implementation and verification:

- Action-item persistence changes.
- PDF upload, replacement, versioning or storage changes.
- Autosave and draft recovery.
- File privacy and signed delivery changes.
- Authentication or session changes.
- Database migrations.
- API contract changes.
- New notification behaviour.
- Message draft persistence or attachment changes.
- Scorecard calculation changes.
- AI context or persistence changes.
- Archive behaviour changes.
- New admin prioritization algorithms.

## First-release definition of done

- All current client and admin routes still exist under the same URLs.
- All existing labels and business terminology remain intact.
- No database migration is included.
- No API response shape or authorization rule changes.
- Business Plan actions can still be viewed and completed.
- Check-Ins can still be submitted.
- Monthly Scorecards can still be submitted.
- Inbox messages can still be sent and received.
- Calendar join links still work.
- Blueprint AI still accepts prompts and returns responses.
- Admin plan editing, client archiving and export still work.
- Desktop, tablet and mobile screenshots are reviewed for every changed route.
- No horizontal overflow or bottom-navigation overlap remains.
- No new console, hydration or uncaught runtime errors are introduced.
- The release is verified on a protected preview before production.
