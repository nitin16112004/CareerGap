import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  from: vi.fn(),
  resumeMaybeSingle: vi.fn(),
  profileMaybeSingle: vi.fn(),
  profileRead: vi.fn(),
  profileUpdate: vi.fn(),
  contactEmailRead: vi.fn(),
  fieldSourceUpsert: vi.fn(),
}));

vi.mock("../config/supabase", () => ({
  getSupabaseStorageClient: () => ({ from: mocked.from }),
}));

import { onboardingService } from "./onboarding.service";
import type { OnboardingProfileInput } from "../validators/onboarding.validators";

const input: OnboardingProfileInput = {
  fullName: "Ava Stone",
  email: "AVA@EXAMPLE.COM",
  phone: "+91 9999999999",
  currentCity: "Bengaluru",
  education: [{ degree: "B.Tech", institution: "Example University" }],
  workExperience: [{ company: "Example Labs", role: "Developer" }],
  skills: ["TypeScript", " TypeScript ", "PostgreSQL"],
  projects: [{ name: "Career API", description: "Built an API." }],
  linkedinUrl: "https://www.linkedin.com/in/ava",
  githubUrl: "https://github.com/ava",
  portfolioUrl: "",
  targetJobRole: "Backend Engineer",
  preferredLocation: "Bengaluru",
  workPreference: "hybrid",
  expectedSalary: "1200000",
  noticePeriod: "30 days",
  careerGoal: "Build reliable backend systems.",
  resumeId: "11111111-1111-4111-8111-111111111111",
  fieldSources: { skills: "manual", full_name: "resume" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocked.resumeMaybeSingle.mockResolvedValue({ data: { id: input.resumeId }, error: null });
  mocked.profileMaybeSingle.mockResolvedValue({
    data: { id: "user-1", email: "login@example.com", onboarding_completed: true },
    error: null,
  });
  mocked.contactEmailRead.mockResolvedValue({ data: null, error: null });
  mocked.fieldSourceUpsert.mockResolvedValue({ error: null });

  mocked.from.mockImplementation((table: string) => {
    if (table === "resumes") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle: mocked.resumeMaybeSingle })),
          })),
        })),
      };
    }
    if (table === "profiles") {
      return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: mocked.profileRead })) })),
        update: mocked.profileUpdate.mockImplementation((patch: Record<string, unknown>) => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({ maybeSingle: mocked.profileMaybeSingle })),
          })),
          __patch: patch,
        })),
      };
    }
    if (table === "profile_field_sources") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle: mocked.contactEmailRead })),
          })),
        })),
        upsert: mocked.fieldSourceUpsert,
      };
    }
    throw new Error(`unexpected table ${table}`);
  });
});

describe("onboardingService", () => {
  it("completes only an owned-resume profile, normalizes fields, and tracks field sources", async () => {
    await expect(onboardingService.complete("user-1", input)).resolves.toMatchObject({
      id: "user-1", email: "login@example.com", contact_email: "ava@example.com", onboarding_completed: true,
    });

    expect(mocked.profileUpdate).toHaveBeenCalledWith(expect.objectContaining({
      full_name: "Ava Stone",
      skills: ["TypeScript", "PostgreSQL"],
      portfolio_url: null,
      onboarding_completed: true,
      education: JSON.stringify(input.education),
      work_experience: JSON.stringify(input.workExperience),
    }));
    expect(mocked.profileUpdate.mock.calls[0][0]).not.toHaveProperty("email");

    const [rows, options] = mocked.fieldSourceUpsert.mock.calls[0];
    expect(options).toEqual({ onConflict: "user_id,field_name" });
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ user_id: "user-1", field_name: "skills", source: "manual" }),
      expect.objectContaining({ user_id: "user-1", field_name: "full_name", source: "resume" }),
      expect.objectContaining({ user_id: "user-1", field_name: "email", field_value: "ava@example.com", source: "resume" }),
      expect.objectContaining({ user_id: "user-1", field_name: "target_job_role", source: "manual" }),
    ]));
  });

  it("returns the reviewed contact email and falls back to the account email on older profiles", async () => {
    mocked.profileRead.mockResolvedValue({ data: { id: "user-1", email: "login@example.com" }, error: null });
    await expect(onboardingService.getProfile("user-1")).resolves.toMatchObject({
      email: "login@example.com", contact_email: "login@example.com",
    });

    mocked.contactEmailRead.mockResolvedValue({ data: { field_value: "ava@example.com" }, error: null });
    await expect(onboardingService.getProfile("user-1")).resolves.toMatchObject({
      email: "login@example.com", contact_email: "ava@example.com",
    });
  });

  it("rejects a resume that is not owned by the current user before profile mutation", async () => {
    mocked.resumeMaybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(onboardingService.saveProfile("user-1", input)).rejects.toMatchObject({
      statusCode: 404,
      code: "RESUME_NOT_FOUND",
    });
    expect(mocked.profileUpdate).not.toHaveBeenCalled();
    expect(mocked.fieldSourceUpsert).not.toHaveBeenCalled();
  });

  it("preserves existing sources on profile edit and attributes only changed fields to manual input", async () => {
    await onboardingService.complete("user-1", input);
    const [saved] = mocked.profileUpdate.mock.calls[0];
    mocked.profileRead.mockResolvedValue({ data: { id: "user-1", email: "login@example.com", ...saved }, error: null });
    mocked.contactEmailRead.mockResolvedValue({ data: { field_value: "ava@example.com" }, error: null });
    mocked.fieldSourceUpsert.mockClear();

    await onboardingService.saveProfile("user-1", {
      ...input,
      currentCity: "Pune",
      resumeId: undefined,
      fieldSources: undefined,
    });

    expect(mocked.fieldSourceUpsert).toHaveBeenCalledWith([expect.objectContaining({
      field_name: "current_city",
      field_value: "Pune",
      source: "manual",
      user_id: "user-1",
    })], { onConflict: "user_id,field_name" });
  });
});
