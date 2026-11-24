import { beforeEach, expect, it, vi } from "vitest";
import { manualIntake } from "@/lib/ops/manual-intake";
const f = vi.hoisted(() => ({
  portalUser: null as object | null,
  reserved: false,
  storedState: "",
}));
vi.mock("@/lib/env", () => ({ getEnv: () => "test-only" }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (name: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: f.portalUser, error: null }),
        }),
      }),
      insert: async (row: { state: string }) => {
        if (name !== "client_manual_intakes") throw Error("unexpected table");
        if (f.reserved) return { error: { code: "23505" } };
        f.reserved = true;
        f.storedState = row.state;
        return { error: null };
      },
      update: (row: { state: string }) => ({
        eq: async () => {
          f.storedState = row.state;
          return { error: null };
        },
      }),
    }),
  }),
}));
const input = {
  email: "example@example.invalid",
  name: "Fictional Member",
  paymentMethod: "bank_transfer",
};
const contact = {
  id: "fictionalcontact01",
  locationId: "93GJEdsr0cT9el3OINXq",
  email: input.email,
  tags: [] as string[],
};
let writes = 0;
beforeEach(() => {
  f.portalUser = null;
  f.reserved = false;
  f.storedState = "";
  contact.tags = [];
  writes = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.endsWith("/search"))
        return Response.json({ contacts: [contact] });
      if (url.endsWith("/tags")) {
        writes++;
        contact.tags = ["manual-onboarding"];
        return Response.json({ tags: contact.tags });
      }
      return Response.json({ contact });
    }),
  );
});
it("starts the verified native flow once and treats retries as already started", async () => {
  expect(await manualIntake(input, "operator")).toEqual({ status: "started" });
  expect(await manualIntake(input, "operator")).toEqual({
    status: "already_started",
  });
  expect(writes).toBe(1);
  expect(f.storedState).toBe("started");
});
it("does not start another contract for a current portal account", async () => {
  f.portalUser = { id: "existing" };
  await expect(manualIntake(input, "operator")).rejects.toThrow(
    "already exists",
  );
  expect(writes).toBe(0);
});
it("holds uncertain requests instead of resending", async () => {
  f.reserved = true;
  await expect(manualIntake(input, "operator")).rejects.toThrow(
    "earlier request",
  );
  expect(writes).toBe(0);
});
it("does not retag someone who already signed their contract", async () => {
  contact.tags = ["contract-signed"];
  expect(await manualIntake(input, "operator")).toEqual({
    status: "already_started",
  });
  expect(writes).toBe(0);
});
