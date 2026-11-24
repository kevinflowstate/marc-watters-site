import { describe, expect, it } from "vitest";
import { intakeFields, parseClientIntake } from "@/lib/client-intake";

const valid = { full_name: "Example Member", phone: "+44 7700 900123", business_name: "Example Builders", home_address: "10 Example Road, Exampletown, BT1 1AA", business_address: "20 Example Lane, Exampletown, BT1 1BB", goals: "Improve quoting" };
describe("first-login intake", () => {
  it.each(Object.keys(intakeFields))("requires %s even when the caller bypasses the form", key => {
    expect(() => parseClientIntake({ ...valid, [key]: "  " })).toThrow(/required/);
  });
  it("trims answers and keeps only the supported fields", () => {
    expect(parseClientIntake({...valid, goals: " Improve quoting ", role: "admin"})).toEqual(valid);
  });
  it("rejects an incomplete mobile number", () => {
    expect(() => parseClientIntake({...valid, phone: "012"})).toThrow(/mobile/);
  });
});
