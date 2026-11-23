import { describe, expect, it } from "vitest";
import { cleanDealPatch, isCancelledStatus, parseBookingPayload, toDeal } from "@/lib/growth-engine-pipeline";

describe("parseBookingPayload", () => {
  it("reads the CRM workflow webhook shape", () => {
    const parsed = parseBookingPayload({
      contact_id: "c1",
      first_name: "Ryan",
      last_name: "O'Neill",
      full_name: "Ryan O'Neill",
      email: "Ryan@OneillRoofing.co.uk",
      phone: "+447700900000",
      company_name: "O'Neill Roofing",
      calendar: { id: "eNaebTx6TpVkXgGe2CZI", appointmentId: "a1", startTime: "2026-11-27T10:30:00+00:00", status: "booked" },
    });
    expect(parsed).toMatchObject({
      appointmentId: "a1",
      contactId: "c1",
      calendarId: "eNaebTx6TpVkXgGe2CZI",
      name: "Ryan O'Neill",
      email: "ryan@oneillroofing.co.uk",
      businessName: "O'Neill Roofing",
      startsAt: "2026-11-27T10:30:00.000Z",
      status: "booked",
    });
  });

  it("reads the raw appointment event shape and deletes as cancelled", () => {
    const parsed = parseBookingPayload({
      type: "AppointmentDelete",
      appointment: { id: "a2", calendarId: "x", contactId: "c2", firstName: "Sam", lastName: "Byrne", startTime: "2026-12-01T09:00:00Z" },
    });
    expect(parsed.name).toBe("Sam Byrne");
    expect(parsed.appointmentId).toBe("a2");
    expect(isCancelledStatus(parsed.status)).toBe(true);
  });
});

describe("cleanDealPatch", () => {
  it("cleans money, links and dates", () => {
    expect(cleanDealPatch({ proposal_value: "£4,500", proposal_url: "https://docs.google.com/x", follow_up_at: "2026-12-02", notes: "  " })).toEqual({
      proposal_value: 4500,
      proposal_url: "https://docs.google.com/x",
      follow_up_at: "2026-12-02",
      notes: null,
    });
    expect(cleanDealPatch({ proposal_url: "javascript:alert(1)", follow_up_at: "tomorrow" })).toEqual({ proposal_url: null, follow_up_at: null });
  });

  it("never blanks the name", () => {
    expect(cleanDealPatch({ contact_name: "" })).toEqual({});
  });
});

describe("toDeal", () => {
  it("hides the storage path", () => {
    const deal = toDeal({ id: "1", position: "2", proposal_value: "1250.00", proposal_file_path: "pipeline/1/a.pdf" });
    expect(deal.has_proposal_file).toBe(true);
    expect(deal.proposal_value).toBe(1250);
    expect("proposal_file_path" in deal).toBe(false);
  });
});
