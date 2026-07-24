# Complete V2 Upgrade Backlog

This is the full agreed backlog. Items are intentionally retained even when they are not suitable for the first, low-risk release.

## 1. Dark design system

- Standardize canvas, surface, raised-surface, border, muted-text and Blueprint blue tokens.
- Define semantic success, warning, danger and informational colours for dark and light themes.
- Establish consistent typography, spacing, radius, border, shadow and motion scales.
- Increase small text sizes and improve line height.
- Reduce routine gradients, texture, glow and hover lift while retaining branded moments.
- Standardize buttons, icon buttons, fields, statuses, cards, tables, modals, drawers, dropdowns and tooltips.
- Define hover, pressed, focused, selected, loading and disabled behaviour.
- Refactor light mode to consume the same tokens rather than broad `!important` overrides.
- Add reduced-motion behaviour.

## 2. Application shell

- Refine the existing sidebar without changing its principal destinations.
- Improve active-page indication, icon consistency and spacing.
- Simplify repetitive desktop header content.
- Fix bottom-navigation overlap and safe-area spacing on mobile.
- Improve the mobile More menu for secondary destinations.
- Consolidate notification, update and install prompts.
- Persist dismissal of the installation prompt.
- Avoid showing the full splash screen during normal authenticated navigation.
- Add consistent route skeletons and transitions.
- Improve session-expiry messaging and preserve unsaved form input where practical.

## 3. Client dashboard

- Keep This Week as the lead section and strengthen its visual hierarchy.
- Place the current Business Plan phase and next outstanding action near the top.
- Improve the next-event presentation and primary action.
- Consolidate the four KPI cards into a tighter summary treatment.
- Move or collapse the full Monthly Scorecard entry form.
- Retain a concise scorecard summary on the dashboard.
- Move Business Plan and Check-In progress higher on the page.
- Reduce total dashboard length.
- Create intentional empty states for missing metrics, events, plans and training.
- Compose a specific mobile content order.
- Prevent bottom navigation from covering dashboard content.

## 4. Business Plan — client experience

- Make the current phase and overall progress more prominent.
- Improve phase presentation without altering Marc's plan structure.
- Make outstanding and completed actions easier to distinguish and scan.
- Improve action spacing, descriptions, deadlines and status presentation.
- Provide a focused view for actions with longer descriptions.
- Improve completion controls, feedback and animation.
- Show saving, saved, failed and retry states.
- Refresh server state after mutation so optimistic actions cannot silently disappear.
- Display the attached PDF consistently.
- Add an inline PDF preview and clear upload status.
- Add basic PDF replacement/version history.
- Improve responsive behaviour for long action lists.

## 5. Business Plan — admin editor

- Improve the desktop and mobile editor layout.
- Add draft recovery or autosave.
- Display explicit save status.
- Warn before leaving with unsaved changes.
- Improve action ordering and drag/reorder behaviour.
- Support efficient entry of several actions without changing the data model.
- Add inline validation and field-specific errors.
- Preserve the current PDF while editing unrelated plan fields.
- Confirm PDF replacement before discarding an existing document.
- Add regression coverage for action persistence and PDF retention.

## 6. Check-Ins

- Keep the Check-In name, questions and scoring structure.
- Improve form hierarchy and spacing.
- Improve 1–10 controls on narrow screens.
- Use accessible, minimum-size touch targets.
- Display completion progress.
- Add autosave or draft recovery.
- Add clear submission, failure and retry states.
- Prevent accidental duplicate submissions.
- Improve history navigation and comparison.
- Present Marc's replies more clearly.
- Improve loading and no-history states.

## 7. Monthly Scorecard

- Keep the current name, metrics and calculations.
- Separate viewing performance from entering the current month's figures.
- Use a compact dashboard summary rather than the complete form.
- Improve charts, period comparison and supporting explanations.
- Make definitions available without cluttering the main view.
- Highlight meaningful changes using existing business language.
- Improve numeric input and keyboard behaviour on mobile.
- Distinguish missing data from zero.
- Add draft, saving and saved feedback.
- Make partially completed scorecards easy to resume.

## 8. Training

- Keep the current content structure and terminology.
- Improve cards, thumbnails and information hierarchy.
- Display duration and content type consistently where data exists.
- Improve assigned, in-progress and completed presentation where supported.
- Add Continue behaviour for partially viewed content where supported.
- Improve video, downloadable resource and attachment presentation.
- Improve search and filtering.
- Add polished loading, empty and error states.
- Improve training detail pages on mobile.
- Improve admin preview before publishing.

## 9. Inbox

- Improve conversation width, spacing and message hierarchy.
- Group messages by date.
- Clarify read and unread states.
- Improve the mobile composer and keyboard handling.
- Add sending, sent, failed and retry feedback.
- Preserve unsent drafts.
- Improve attachment upload progress and preview.
- Deep-link notifications to the correct conversation.
- Improve the client-context panel for Marc.
- Replace the current large empty loading panel with a useful skeleton.

## 10. Calendar

- Improve event-card hierarchy and information density.
- Make Join Call the clear primary action when applicable.
- Prevent metadata and buttons from becoming cramped on mobile.
- Separate upcoming and past events visually.
- Display timezone clearly.
- Improve loading, empty and error states.
- Add Add to Calendar where practical.
- Present descriptions, links and supporting resources more clearly.

## 11. Blueprint AI

- Keep the Blueprint AI name and current role.
- Improve chat width, spacing and typography.
- Add polished streaming, thinking and stopped states.
- Improve existing suggested prompts.
- Preserve conversation state reliably.
- Add clear failure and retry handling.
- Improve usage-limit messaging.
- Improve mobile composition and scrolling.
- Make existing plan and portal context easier to reference where already supported.
- Avoid creating a new AI-led coaching process.

## 12. Settings

- Retain the current settings and account structure.
- Group existing fields more clearly.
- Improve spacing and responsive layout.
- Add consistent save confirmation and validation.
- Improve notification and push controls.
- Present PWA installation status contextually.
- Clarify account and archive status.

## 13. Admin dashboard

- Keep the Blueprint AI operating brief but group entries by urgency.
- Show the most important items first and allow the rest to expand.
- Improve Send Nudge, Dismiss and View Plan controls.
- Confirm successful admin actions and handle failures visibly.
- Make dismissed items behave predictably.
- Bring clients and recent Check-Ins higher on the page.
- Improve filtering and reduce total page length.
- Make status and attention reasons easier to scan.

## 14. Client management

- Improve search, sorting and filtering.
- Increase useful information density in the client list.
- Make archived clients visually distinct.
- Retain existing statuses and terminology.
- Improve the client-detail header and section hierarchy.
- Present plan, Check-Ins, metrics, messages and recent activity coherently.
- Improve archive, reactivate and export controls.
- Make archived clients read-only where appropriate.
- Strengthen confirmation around permanent deletion.
- Preserve the distinction between archive and deletion.

## 15. Shared application states

- Create reusable skeletons for each page shape.
- Create purposeful empty states with a relevant next action.
- Standardize inline and page-level errors.
- Provide retry actions for recoverable failures.
- Standardize saving and saved feedback.
- Add offline and reconnection states.
- Improve permission-denied and session-expired states.
- Avoid content jumps when loading finishes.

## 16. Reliability, privacy and observability

- Resolve the live React hydration mismatch.
- Verify action-item persistence from admin save through client rendering.
- Verify PDF retention and refresh behaviour.
- Add automated regression tests for plan actions and PDFs.
- Eliminate silent data-fetch and mutation failures.
- Add user-visible recovery paths.
- Add operational error monitoring and useful server logs.
- Add audit history for important admin changes.
- Review plan PDF and attachment privacy.
- Use authorized, expiring file delivery where required.
- Validate file type, size and authorization consistently.
- Rate-limit expensive or abuse-sensitive endpoints.
- Improve session-expiry handling.

## 17. Accessibility and responsive quality

- Increase minimum readable text sizes.
- Verify contrast across dark and optional light themes.
- Standardize visible keyboard focus.
- Use semantic controls and correctly associated labels/errors.
- Maintain at least 44px touch targets for principal mobile controls.
- Ensure status is not communicated by colour alone.
- Respect reduced-motion preferences.
- Add accessible summaries for charts.
- Verify every existing client and admin route at desktop, tablet and mobile sizes.
- Complete physical iPhone and iPad verification before production release.
