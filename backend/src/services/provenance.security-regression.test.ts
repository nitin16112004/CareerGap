import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({ from: vi.fn(), upsert: vi.fn(), profileUpdate: vi.fn() }));
vi.mock("../config/supabase", () => ({ getSupabaseStorageClient: () => ({ from: mocked.from }) }));
import { onboardingService } from "./onboarding.service";
import { onboardingProfileSchema } from "../validators/onboarding.validators";

const A = "11111111-1111-4111-8111-111111111111";
const body = (source: "manual" | "ai" | "system") => ({
  fullName: "Owner A", email: "owner-a@example.invalid", phone: "+91 9999999999",
  skills: ["TypeScript"], targetJobRole: "Backend Engineer", preferredLocation: "Remote",
  workPreference: "remote", fieldSources: { skills: source }, role: "admin", email_verified: true,
});

beforeEach(() => {
  vi.resetAllMocks();
  mocked.upsert.mockResolvedValue({ error: null });
  mocked.from.mockImplementation((table: string) => {
    if (table === "profile_field_sources") {
      return {
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
        upsert: mocked.upsert,
      };
    }
    if (table !== "profiles") throw new Error("Unexpected relation in test: " + table);
    const profile = { data: { id: A, email: "owner-a@example.invalid" }, error: null };
    return {
      select: () => ({ eq: () => ({ maybeSingle: async () => profile }) }),
      update: mocked.profileUpdate.mockImplementation(() => ({
        eq: () => ({ select: () => ({ maybeSingle: async () => profile }) }),
      })),
    };
  });
});

describe("S2 profile provenance is not a client assertion of server authority", () => {
  it.each(["ai", "system"] as const)("S2-PROVENANCE refuses client claim %s as trusted stored provenance", async (source) => {
    const parsed = onboardingProfileSchema.safeParse({ body: body(source), query: {}, params: {} });
    if (!parsed.success) return; // Rejection at the real schema is also a safe boundary.
    await onboardingService.saveProfile(A, parsed.data.body).catch(() => undefined);
    const written = mocked.upsert.mock.calls.flatMap(([rows]) => rows as Array<Record<string, unknown>>);
    expect(written.filter((row) => row.field_name === "skills" && row.source === source),
      "Client-supplied ai/system label must not be persisted as trusted evidence").toEqual([]);
  });

  it("S2-MANUAL retains profile edits/manual provenance and strips authorization claims", async () => {
    const parsed = onboardingProfileSchema.parse({ body: body("manual"), query: {}, params: {} });
    await onboardingService.saveProfile(A, parsed.body);
    expect(mocked.profileUpdate).toHaveBeenCalledWith(expect.objectContaining({ skills: ["TypeScript"] }));
    const patch = mocked.profileUpdate.mock.calls[0][0];
    expect(patch).not.toHaveProperty("role");
    expect(patch).not.toHaveProperty("email_verified");
    expect(mocked.upsert.mock.calls[0][0]).toContainEqual(expect.objectContaining({
      user_id: A, field_name: "skills", source: "manual",
    }));
  });
});
