# V2 Scope and Design Guardrails

## Product boundaries

V2 must retain:

- The dark-first Construction Business Blueprint identity.
- The existing logo, brand recognition and Blueprint blue accent.
- Business Plan, Check-In, Monthly Scorecard, Training, Inbox, Calendar and Blueprint AI terminology.
- The existing coaching structure, plan phases and action-item model.
- The current client and admin separation.
- The broad existing information architecture and routes.
- Light mode as an available option if it remains supported, without making it the primary direction.

V2 must not:

- Reframe the portal as a different product or “operating system.”
- Rename Check-Ins or other established business concepts.
- Introduce new lifecycle terminology solely for design reasons.
- Copy Flowstate's campaign, reporting or marketing language.
- Make clients relearn the principal navigation.
- Use a light-first visual direction.
- Place visual novelty ahead of task clarity and reliability.

## Design setup

- **Workflow:** Full design-system upgrade followed by route-by-route implementation and responsive visual QA.
- **Aesthetic lane:** Premium dark construction coaching workspace.
- **Real references:** The current Construction Business Blueprint brand for identity; Flowstate V2 for hierarchy and application-state quality; Linear for operational clarity; Stripe for trustworthy forms and data presentation.
- **Typography:** Retain the current brand typography initially. Improve the scale, weight hierarchy, line height and minimum body size before considering any font replacement.
- **Colour:** Preserve the existing near-black canvas, dark surfaces and Blueprint blue. Introduce consistent semantic success, warning, danger, muted-text and border tokens.
- **Spacing:** Use an 8px base rhythm with a smaller 4px step for compact controls.
- **Radius:** Use a restrained three-level radius system instead of unrelated values.
- **Density:** Calm and guided for clients; more compact and scannable for admin.
- **Depth:** Borders and subtle tonal separation first; glow and stronger shadows only for deliberate emphasis.
- **Motion:** Approximately 160–220ms for controls and 240–320ms for drawers or page-level transitions, with reduced-motion support.
- **Output template:** Existing client and admin routes, with dedicated desktop, tablet, mobile and application-state designs.

## Generic patterns to avoid

- Every section becoming another equal-weight card.
- Decorative gradients or glows on routine controls.
- Noise textures reducing text clarity.
- Tiny uppercase labels throughout the interface.
- Pills used for decoration rather than real statuses.
- Repeated introductory copy that pushes the useful content down.
- Large empty panels containing only a spinner or one line of text.
- Desktop cards simply stacked into a very long mobile page.
- Hover lift applied to every interactive surface.
- New terminology introduced to make an unchanged feature sound more fashionable.

## Experience principles

### Familiar first

Existing users should recognize every destination and understand where their information has gone. Reordering content within a page is acceptable; moving core functionality to unexpected routes is not part of the initial upgrade.

### One clear priority

Each screen should establish one primary task or message before showing supporting data. Existing information remains available, but it should not all compete at equal visual weight.

### Dark does not mean low-contrast

Dark mode must have readable body text, visible borders, clear focus states and distinct surface levels. Small grey text on black is not inherently premium.

### State quality is part of the design

Loading, empty, error, saving, saved, offline and permission states require designed treatments. They must not look like unfinished versions of the screen.

### Mobile is deliberately composed

Mobile screens should prioritize, collapse and reorder existing information. They should not be desktop layouts squeezed into a narrow viewport.

### Reliability remains visible

When clients or Marc make a change, the interface must say whether it is saving, saved or failed. Optimistic changes must reconcile correctly with the server and must never silently disappear.
