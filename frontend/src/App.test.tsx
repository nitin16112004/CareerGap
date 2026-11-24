import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterAll, afterEach, expect, it, vi } from "vitest";
import { App } from "./App";
import { AuthContext } from "./hooks/use-auth";
import type { DashboardSummary } from "./services/dashboard.service";

vi.hoisted(() => vi.stubEnv("VITE_BILLING_ENABLED", undefined));
vi.mock("./lib/supabase", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}));
afterAll(() => vi.unstubAllEnvs());
afterEach(() => vi.unstubAllGlobals());

const BackButton = (): JSX.Element => {
  const navigate = useNavigate();
  return <button type="button" onClick={() => void navigate(-1)}>Back</button>;
};

it("makes the landing and features pages reachable before sign-in", async () => {
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);

  expect(screen.getByRole("heading", { name: "Build a job-ready career path with AI" })).toBeInTheDocument();
  await user.click(screen.getByRole("link", { name: "View features" }));
  expect(screen.getByRole("heading", { name: "CareerGuid AI features" })).toBeInTheDocument();
});

it.each(["/missing-page", "/billing", "/billing/checkout"])("shows the not-found page for %s", (path) => {
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);

  expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
});

it("shows the empty Skill Gap page and returns to the dashboard with Back", async () => {
  const user = userEvent.setup();
  const dashboard: DashboardSummary = {
    profile: { full_name: "Test User" },
    profileCompletion: 100,
    resume: null,
    skillAnalysis: null,
    roadmap: null,
    pendingTasks: 0,
    completedTasks: 0,
    overdueTasks: 0,
    generatedResume: null,
    reminder: {
      preferences: { emailEnabled: false, weeklyPendingEnabled: false, inactiveEnabled: false, motivationalEnabled: false },
      includedInPlan: false,
      lastReminder: null,
      unreadNotifications: 0,
      progress: null,
    },
  };
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.endsWith("/dashboard/summary")) return Response.json({ success: true, data: dashboard });
    if (url.endsWith("/job-roles")) return Response.json({ success: true, data: [] });
    if (url.endsWith("/skill-gap/latest")) return Response.json({ success: true, data: null });
    throw new Error(`Unexpected request to ${url}`);
  }));

  render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <AuthContext.Provider value={{
        session: null,
        user: { id: "user-1", app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "2026-01-01" },
        profile: { id: "user-1", email: "user@example.test", full_name: "Test User", onboarding_completed: true, email_verified: true, role: "user" },
        loading: false,
        refreshAuth: vi.fn(),
        signOut: vi.fn(),
      }}>
        <BackButton />
        <App />
      </AuthContext.Provider>
    </MemoryRouter>,
  );

  await screen.findByRole("heading", { name: "Welcome, Test" }, { timeout: 5_000 });
  await user.click(screen.getByRole("link", { name: "Skill gap" }));
  expect(await screen.findByRole("heading", { name: "No skill analysis yet" }, { timeout: 5_000 })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Back" }));
  expect(await screen.findByRole("heading", { name: "Welcome, Test" }, { timeout: 5_000 })).toBeInTheDocument();
});
