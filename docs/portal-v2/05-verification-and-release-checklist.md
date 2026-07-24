# V2 Verification and Release Checklist

Use this checklist for every V2 phase. The exercised routes and screenshots should match the scope of that phase.

## Repository and deployment scope

- [ ] The working tree was reviewed before implementation.
- [ ] The change set contains only the intended V2 phase.
- [ ] No unrelated local work is included.
- [ ] Database migrations, API changes and environment changes are explicitly listed.
- [ ] The target Vercel project and all production aliases are confirmed.
- [ ] A protected preview is available for review.

## Client critical-path regression

- [ ] Sign in and sign out.
- [ ] Load the client dashboard.
- [ ] Open the Business Plan.
- [ ] View all plan actions.
- [ ] Complete an action and confirm it remains completed after refresh.
- [ ] View the current plan PDF where present.
- [ ] Submit a Check-In and confirm the saved result.
- [ ] Submit a Monthly Scorecard and confirm the saved result.
- [ ] Open Training content.
- [ ] Send and receive an Inbox message.
- [ ] Open Calendar and use a valid Join Call link.
- [ ] Submit a Blueprint AI prompt and receive a response.
- [ ] Update a supported setting and confirm persistence.

## Admin critical-path regression

- [ ] Sign in as admin.
- [ ] Load the admin dashboard and operating brief.
- [ ] Open client search/list and client detail.
- [ ] Create or edit a Business Plan.
- [ ] Add more than three actions, save, refresh and confirm all actions remain.
- [ ] Edit a plan with an existing PDF and confirm the PDF remains.
- [ ] Upload/replace a PDF where included in the release scope.
- [ ] Review and reply to a Check-In.
- [ ] Send a client message.
- [ ] Create/edit Training content where included in scope.
- [ ] Archive a test client, view the archived record and reactivate it.
- [ ] Export an archived test client's data.

## Responsive visual QA

- [ ] Desktop checked at approximately 1440px wide.
- [ ] Tablet checked at approximately 768px wide.
- [ ] Mobile checked at approximately 390px wide.
- [ ] Narrow mobile checked at approximately 320px wide where practical.
- [ ] No horizontal overflow.
- [ ] No clipped labels or compressed primary actions.
- [ ] Bottom navigation does not cover content.
- [ ] Mobile keyboard does not cover required form controls.
- [ ] Long names, action descriptions and messages wrap correctly.
- [ ] Empty, loading, error and success states are checked.
- [ ] Dark-theme contrast and focus states are checked.
- [ ] Reduced-motion behaviour is checked where animations changed.

## Runtime and data verification

- [ ] No new console errors.
- [ ] No new hydration warnings.
- [ ] No failed requests during the tested paths.
- [ ] Saved changes survive a hard refresh and a new authenticated session.
- [ ] Optimistic UI reconciles with the server response.
- [ ] Errors produce visible feedback and recovery where appropriate.
- [ ] Permissions remain correct for client, archived client and admin users.

## Production release

- [ ] Preview approval is recorded.
- [ ] The production deployment contains the reviewed commit.
- [ ] Every intended production domain resolves to that deployment.
- [ ] Critical client and admin smoke tests pass against production.
- [ ] Error monitoring is checked immediately after deployment.
- [ ] A rollback target is known before release.
