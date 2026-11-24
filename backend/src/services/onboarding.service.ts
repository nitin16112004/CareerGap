import { isDeepStrictEqual } from "node:util";
import { getSupabaseStorageClient } from "../config/supabase";
import type { OnboardingProfileInput } from "../validators/onboarding.validators";
import { HttpError } from "../utils/http-error";

const serialize = (value: unknown): string | null => {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "string" ? value : JSON.stringify(value);
};

const assertOwnedResume = async (userId: string, resumeId?: string): Promise<void> => {
  if (!resumeId) return;
  const { data, error } = await getSupabaseStorageClient()
    .from("resumes")
    .select("id")
    .eq("id", resumeId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new HttpError(500, "Unable to validate the resume.", "ONBOARDING_RESUME_LOOKUP_FAILED", false);
  if (!data) throw new HttpError(404, "Resume not found.", "RESUME_NOT_FOUND");
};

const profilePatch = (input: OnboardingProfileInput) => ({
  full_name: input.fullName,
  phone: input.phone,
  current_city: input.currentCity,
  education: serialize(input.education),
  work_experience: serialize(input.workExperience),
  skills: [...new Set(input.skills.map((skill) => skill.trim()).filter(Boolean))],
  projects: input.projects,
  linkedin_url: input.linkedinUrl || null,
  github_url: input.githubUrl || null,
  portfolio_url: input.portfolioUrl || null,
  target_job_role: input.targetJobRole,
  preferred_location: input.preferredLocation,
  work_preference: input.workPreference,
  expected_salary: input.expectedSalary,
  notice_period: input.noticePeriod,
  career_goal: input.careerGoal,
});

const manualFields = new Set(["target_job_role", "preferred_location", "work_preference", "expected_salary", "notice_period", "career_goal"]);

const upsertFieldSources = async (userId: string, input: OnboardingProfileInput, fields: [string, unknown][]): Promise<void> => {
  if (!fields.length) return;
  const rows = fields.map(([fieldName, value]) => {
    const declaredSource = input.fieldSources?.[fieldName];
    const fromResume = input.resumeId && !manualFields.has(fieldName)
      && (declaredSource === undefined || declaredSource === "resume");
    return {
      user_id: userId,
      field_name: fieldName,
      field_value: serialize(value),
      source: fromResume ? "resume" : "manual",
      confidence_score: null,
      is_review_required: false,
    };
  });

  const { error } = await getSupabaseStorageClient()
    .from("profile_field_sources")
    .upsert(rows, { onConflict: "user_id,field_name" });
  if (error) throw new HttpError(500, "Unable to save profile field sources.", "PROFILE_FIELD_SOURCE_SAVE_FAILED", false);
};

const getProfile = async (userId: string) => {
  const { data, error } = await getSupabaseStorageClient()
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new HttpError(500, "Unable to load your profile.", "PROFILE_LOAD_FAILED", false);
  if (!data) throw new HttpError(404, "Profile not found.", "PROFILE_NOT_FOUND");

  const { data: emailField, error: emailError } = await getSupabaseStorageClient()
    .from("profile_field_sources")
    .select("field_value")
    .eq("user_id", userId)
    .eq("field_name", "email")
    .maybeSingle();
  if (emailError) throw new HttpError(500, "Unable to load your profile.", "PROFILE_LOAD_FAILED", false);
  return { ...data, contact_email: emailField?.field_value ?? data.email };
};

const saveProfile = async (userId: string, input: OnboardingProfileInput, complete: boolean) => {
  await assertOwnedResume(userId, input.resumeId);
  const patch = profilePatch(input);
  // The reviewed email is a contact detail. The account email comes from Supabase Auth.
  const contactEmail = input.email.toLowerCase();
  let fields = Object.entries({ ...patch, email: contactEmail });
  if (!complete && !input.resumeId) {
    const previous = await getProfile(userId);
    const fieldSources = input.fieldSources;
    fields = fields.filter(([fieldName, value]) => {
      if (fieldSources && Object.hasOwn(fieldSources, fieldName)) return true;
      if (fieldName === "email") return previous.contact_email !== value;
      return !fieldSources && !isDeepStrictEqual(previous[fieldName], value);
    });
  }
  const { data, error } = await getSupabaseStorageClient()
    .from("profiles")
    .update({ ...patch, ...(complete ? { onboarding_completed: true } : {}) })
    .eq("id", userId)
    .select("*")
    .maybeSingle();
  if (error) throw new HttpError(500, "Unable to save your profile.", "PROFILE_SAVE_FAILED", false);
  if (!data) throw new HttpError(404, "Profile not found.", "PROFILE_NOT_FOUND");
  await upsertFieldSources(userId, input, fields);
  return { ...data, contact_email: contactEmail };
};

export const onboardingService = {
  getProfile,
  saveProfile: (userId: string, input: OnboardingProfileInput) => saveProfile(userId, input, false),
  complete: (userId: string, input: OnboardingProfileInput) => saveProfile(userId, input, true),
};
