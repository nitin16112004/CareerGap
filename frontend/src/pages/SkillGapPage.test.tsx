import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiError } from "../services/api";
import { SkillGapPage } from "./SkillGapPage";

const mocked = vi.hoisted(() => ({
  billingEnabled: false,
  listRoles: vi.fn(),
  latest: vi.fn(),
  analyze: vi.fn(),
  generate: vi.fn(),
  generateRagAndWait: vi.fn(),
}));

vi.mock("../config", () => ({
  get billingEnabled() { return mocked.billingEnabled; },
}));

vi.mock("../services/skill-gap.service", () => ({
  skillGapService: { listRoles: mocked.listRoles, latest: mocked.latest, analyze: mocked.analyze },
}));

vi.mock("../services/roadmap.service", () => ({
  roadmapService: { generate: mocked.generate, generateRagAndWait: mocked.generateRagAndWait },
}));

const role = { id: "role-1", role_name: "Backend Engineer", role_slug: "backend-engineer", role_description: "Build reliable APIs." };
const analysis = {
  id: "analysis-1",
  role_id: role.id,
  match_score: 50,
  current_skills: ["TypeScript"],
  matched_skills: ["TypeScript"],
  missing_skills: ["PostgreSQL", "Redis"],
  recommended_skills: ["PostgreSQL", "Redis"],
  learning_order: ["PostgreSQL", "Redis"],
  role,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocked.billingEnabled = false;
  sessionStorage.clear();
  mocked.listRoles.mockResolvedValue([role]);
  mocked.latest.mockResolvedValue(analysis);
  mocked.analyze.mockResolvedValue(analysis);
  mocked.generate.mockResolvedValue({ id: "roadmap-basic" });
  mocked.generateRagAndWait.mockResolvedValue("roadmap-rag");
});

const renderPage = () => render(
  <MemoryRouter initialEntries={["/skill-gap"]}>
    <Routes>
      <Route path="/skill-gap" element={<SkillGapPage />} />
      <Route path="/roadmap/:roadmapId" element={<div>ROADMAP_TARGET</div>} />
      <Route path="/billing" element={<div>BILLING_TARGET</div>} />
    </Routes>
  </MemoryRouter>,
);

describe("SkillGapPage", () => {
  it("renders the latest analysis with score, matched/missing skills, and learning order", async () => {
    renderPage();

    expect(await screen.findByText("50%")).toBeInTheDocument();
    expect(screen.getAllByText("TypeScript").length).toBeGreaterThan(0);
    expect(screen.getAllByText("PostgreSQL").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Redis").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /generate ai roadmap/i })).toBeInTheDocument();
    expect(screen.queryByText(/require Pro or Premium/i)).not.toBeInTheDocument();
  });

  it("passes the selected role and latest resume id into a refreshed analysis", async () => {
    sessionStorage.setItem("careerguid:last-resume-id", "resume-1");
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("50%");

    await user.click(screen.getByRole("button", { name: /analyze skill gap/i }));

    await waitFor(() => expect(mocked.analyze).toHaveBeenCalledWith("role-1", "resume-1"));
    expect(await screen.findByText(/analysis updated from your current profile/i)).toBeInTheDocument();
  });

  it("keeps the catalog usable when the previous analysis cannot load", async () => {
    mocked.latest.mockRejectedValueOnce(new Error("Analysis unavailable"));
    const user = userEvent.setup();
    renderPage();

    const picker = await screen.findByRole("combobox", { name: /target job role/i });
    await user.selectOptions(picker, "role-1");
    await user.click(screen.getByRole("button", { name: /analyze skill gap/i }));

    expect(mocked.analyze).toHaveBeenCalledWith("role-1", undefined);
  });

  it("shows when the catalog is empty and allows it to reload", async () => {
    mocked.listRoles.mockResolvedValueOnce([]);
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText(/no active job roles/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /analyze skill gap/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /retry loading roles/i }));

    expect(await screen.findByRole("option", { name: "Backend Engineer" })).toBeInTheDocument();
  });

  it("generates a roadmap for the analyzed role when a different role is selected", async () => {
    mocked.listRoles.mockResolvedValueOnce([role, { id: "role-2", role_name: "Frontend Developer", role_slug: "frontend-developer" }]);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("50%");

    await user.selectOptions(screen.getByRole("combobox", { name: /target job role/i }), "role-2");
    await user.click(screen.getByRole("button", { name: /use basic plan/i }));

    expect(await screen.findByText("ROADMAP_TARGET")).toBeInTheDocument();
    expect(mocked.generate).toHaveBeenCalledWith({ skillAnalysisId: "analysis-1", roleId: "role-1", roleName: "Backend Engineer" });
  });

  it("turns a paid RAG entitlement error into an upgrade callout instead of losing the analysis", async () => {
    mocked.billingEnabled = true;
    mocked.generateRagAndWait.mockRejectedValue(new ApiError("Upgrade required for AI roadmap.", 402, "PLAN_UPGRADE_REQUIRED"));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("50%");

    await user.click(screen.getByRole("button", { name: /generate ai roadmap/i }));

    expect(await screen.findByText(/current plan does not include this action/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view plans/i })).toHaveAttribute("href", "/billing?plan=pro");
    expect(screen.getByText("50%")).toBeInTheDocument();
  });
});
