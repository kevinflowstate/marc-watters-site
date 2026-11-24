// Immutable identities verified against the CBB production admin directory.
// Names and user-editable profile metadata do not confer manager access.
export const MARC_USER_ID = "b841ec81-1b53-41dd-b6ec-ba6af673f1ad";
export const EIMEAR_USER_ID = "52957509-d5e3-4979-9c21-823958d5ae1f";

// Both addresses were confirmed in the production auth directory and belong to Kevin.
export const KEVIN_FLOWSTATE_ADMIN_ID = "5b792fb8-a90d-4d4c-9b5d-c1bc250487f3";
export const KEVIN_GMAIL_ADMIN_ID = "5d71b54b-bc87-480d-b427-d67c91156302";

export function businessCapabilities(actor: string) {
  const manager = [MARC_USER_ID, KEVIN_FLOWSTATE_ADMIN_ID, KEVIN_GMAIL_ADMIN_ID].includes(actor);
  return { canViewRevenue: manager, canViewTeamActivity: manager };
}
