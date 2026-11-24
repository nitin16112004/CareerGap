import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AuthCard } from "../components/auth/AuthCard";
import { ErrorMessage, SuccessMessage } from "../components/auth/FeedbackMessage";
import { InputField } from "../components/auth/InputField";
import { ExtractedDataForm } from "../components/resume/ExtractedDataForm";
import { onboardingService, type OnboardingProfileRecord, type WorkPreference } from "../services/onboarding.service";
import { resumeService, type ResumeHistoryItem } from "../services/resume.service";
import { skillGapService, type JobRole } from "../services/skill-gap.service";
import type { ExtractedResumeData, ResumeEducation } from "../types/resume";

const toEntries = (value: unknown): ResumeEducation[] => {
  if (typeof value === "string") {
    if (!value.trim()) return [];
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) return toEntries(parsed);
    } catch {
      // Older profiles can store free text in these columns.
    }
    return [{ details: value }];
  }
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry: unknown) => {
    if (typeof entry === "string") return [{ details: entry }];
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const details = item.details ?? item.description ?? item.name;
    return [{ ...item, details: typeof details === "string" ? details : "" }];
  });
};

const retainOriginalText = (original: string | null, edited: ResumeEducation[]): string | ResumeEducation[] | undefined => (
  JSON.stringify(toEntries(original)) === JSON.stringify(edited) ? original ?? undefined : edited
);

const profileDetails = (profile: OnboardingProfileRecord): ExtractedResumeData => ({
  name: profile.full_name ?? "",
  email: profile.contact_email ?? profile.email,
  phone: profile.phone ?? "",
  city: profile.current_city ?? "",
  education: toEntries(profile.education),
  experience: toEntries(profile.work_experience),
  skills: profile.skills ?? [],
  projects: toEntries(profile.projects),
  linkedin: profile.linkedin_url ?? "",
  github: profile.github_url ?? "",
  portfolio: profile.portfolio_url ?? "",
});

export const ProfilePage = (): JSX.Element => {
  const [profile, setProfile] = useState<OnboardingProfileRecord | null>(null);
  const [details, setDetails] = useState<ExtractedResumeData | null>(null);
  const [roles, setRoles] = useState<JobRole[]>([]);
  const [history, setHistory] = useState<ResumeHistoryItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.allSettled([onboardingService.getProfile(), resumeService.history(), skillGapService.listRoles()])
      .then(([profileResult, historyResult, rolesResult]) => {
        if (!active) return;
        if (profileResult.status === "fulfilled") {
          setProfile(profileResult.value);
          setDetails(profileDetails(profileResult.value));
        } else {
          setError("Unable to load your profile. Reload the page to try again.");
        }
        if (historyResult.status === "fulfilled") setHistory(historyResult.value);
        if (rolesResult.status === "fulfilled") setRoles(rolesResult.value);
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const update = <K extends keyof OnboardingProfileRecord>(key: K, value: OnboardingProfileRecord[K]): void => {
    setProfile((current) => current ? { ...current, [key]: value } : current);
    setSaved(false);
  };

  const save = async (): Promise<void> => {
    if (!profile || !details || saving) return;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await onboardingService.save({
        fullName: details.name,
        email: details.email,
        phone: details.phone,
        currentCity: details.city || null,
        education: retainOriginalText(profile.education, details.education),
        workExperience: retainOriginalText(profile.work_experience, details.experience),
        skills: details.skills,
        projects: JSON.stringify(details.projects) === JSON.stringify(toEntries(profile.projects)) ? profile.projects ?? [] : details.projects,
        linkedinUrl: details.linkedin,
        githubUrl: details.github,
        portfolioUrl: details.portfolio,
        targetJobRole: profile.target_job_role ?? "",
        preferredLocation: profile.preferred_location ?? "",
        workPreference: profile.work_preference ?? "hybrid",
        expectedSalary: profile.expected_salary,
        noticePeriod: profile.notice_period,
        careerGoal: profile.career_goal,
      });
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save your profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthCard className="onboarding-card" title="Career profile" subtitle="Update the details used in your skill analysis, roadmap, and resume builder.">
      <ErrorMessage>{error}</ErrorMessage>
      <SuccessMessage>{saved ? "Career profile saved." : ""}</SuccessMessage>
      {loading && <p role="status">Loading your profile…</p>}
      {profile && details && (
        <ExtractedDataForm profileEditor data={details} saving={saving} onSubmit={() => { void save(); }} onChange={(next) => { setDetails(next); setSaved(false); }}>
          <section className="resume-form-section" aria-labelledby="profile-preferences">
            <div className="section-heading"><h2 id="profile-preferences">Career preferences</h2></div>
            <div className="review-form-grid">
              <InputField label="Target job role" name="target-role" value={profile.target_job_role ?? ""} onChange={(event) => update("target_job_role", event.target.value)} list="profile-role-options" required />
              <datalist id="profile-role-options">{roles.map((role) => <option key={role.id} value={role.role_name} />)}</datalist>
              <InputField label="Preferred location" name="preferred-location" value={profile.preferred_location ?? ""} onChange={(event) => update("preferred_location", event.target.value)} required />
              <label className="field-label">Work preference
                <select className="auth-input" value={profile.work_preference ?? "hybrid"} onChange={(event) => update("work_preference", event.target.value as WorkPreference)}>
                  <option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option>
                </select>
              </label>
              <InputField label="Expected salary" name="expected-salary" value={profile.expected_salary ?? ""} onChange={(event) => update("expected_salary", event.target.value)} />
              <InputField label="Notice period" name="notice-period" value={profile.notice_period ?? ""} onChange={(event) => update("notice_period", event.target.value)} />
              <InputField label="Career goal" name="career-goal" value={profile.career_goal ?? ""} onChange={(event) => update("career_goal", event.target.value)} />
            </div>
          </section>
        </ExtractedDataForm>
      )}
      {!loading && (
        <section className="career-preferences-card" aria-labelledby="profile-resume-history">
          <div className="section-heading"><h2 id="profile-resume-history">Resume history</h2><Link className="text-link" to="/onboarding/upload-resume">Upload a resume</Link></div>
          {history === null && <p>Unable to load resume history.</p>}
          {history?.length === 0 && <p>You haven’t uploaded a resume yet.</p>}
          {Boolean(history?.length) && <ul className="reminder-history-list">{history?.map((resume) => (
            <li className="reminder-history-item" key={resume.id}><strong>{resume.file_name}</strong><span>{new Date(resume.created_at).toLocaleDateString()} · {resume.parsing_status}</span></li>
          ))}</ul>}
        </section>
      )}
    </AuthCard>
  );
};
