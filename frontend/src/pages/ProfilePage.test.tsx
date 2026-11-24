import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { onboardingService } from "../services/onboarding.service";
import { resumeService } from "../services/resume.service";
import { skillGapService } from "../services/skill-gap.service";
import { ProfilePage } from "./ProfilePage";

vi.mock("../services/onboarding.service", () => ({
  onboardingService: { getProfile: vi.fn(), save: vi.fn() },
}));
vi.mock("../services/resume.service", () => ({
  resumeService: { history: vi.fn() },
}));
vi.mock("../services/skill-gap.service", () => ({
  skillGapService: { listRoles: vi.fn() },
}));

it("edits skills while preserving unchanged legacy profile fields and displaying resume history", async () => {
  const profile = {
    id: "profile-1",
    full_name: "Anita Sharma",
    email: "anita@example.com",
    contact_email: "contact@example.com",
    phone: "5550100123",
    current_city: null,
    education: "Bachelor of Computer Applications",
    work_experience: null,
    skills: ["JavaScript"],
    projects: [],
    linkedin_url: null,
    github_url: null,
    portfolio_url: null,
    target_job_role: "Frontend Developer",
    preferred_location: "Pune",
    work_preference: "hybrid" as const,
    expected_salary: null,
    notice_period: null,
    career_goal: null,
    onboarding_completed: true,
  };
  vi.mocked(onboardingService.getProfile).mockResolvedValue(profile);
  vi.mocked(onboardingService.save).mockResolvedValue(profile);
  vi.mocked(skillGapService.listRoles).mockResolvedValue([]);
  vi.mocked(resumeService.history).mockResolvedValue([{
    id: "resume-1",
    file_name: "career-resume.pdf",
    file_type: "application/pdf",
    file_size: 255,
    parsing_status: "completed",
    created_at: "2026-11-20T09:00:00.000Z",
  }]);

  render(<MemoryRouter><ProfilePage /></MemoryRouter>);

  const skills = await screen.findByRole("textbox", { name: /separate each skill/i });
  expect(screen.getByText("career-resume.pdf")).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: /contact email/i })).toHaveValue("contact@example.com");
  fireEvent.change(skills, { target: { value: "JavaScript," } });
  expect(skills).toHaveValue("JavaScript,");
  fireEvent.change(skills, { target: { value: "JavaScript, React" } });
  fireEvent.click(screen.getByRole("button", { name: /save profile/i }));

  await waitFor(() => expect(onboardingService.save).toHaveBeenCalledWith(expect.objectContaining({
    email: "contact@example.com",
    skills: ["JavaScript", "React"],
    education: "Bachelor of Computer Applications",
    workExperience: undefined,
  })));
  expect(await screen.findByText("Career profile saved.")).toBeInTheDocument();
});
