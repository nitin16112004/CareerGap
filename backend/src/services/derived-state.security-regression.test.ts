import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), update: vi.fn(), remove: vi.fn(), storageFrom: vi.fn() }));
vi.mock("../config/supabase", () => ({
  getSupabaseStorageClient: () => ({ from: mocked.from, rpc: mocked.rpc, storage: { from: mocked.storageFrom } }),
}));
vi.mock("../jobs/queues", () => ({ createQueue: () => ({ add: vi.fn() }) }));
import { atsResumeService } from "./ats-resume.service";
import { roadmapService } from "./roadmap.service";
import { skillGapService } from "./skill-gap.service";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const GA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const RM = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const taskId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const query = (data: unknown) => {
  const q: Record<string, any> = {};
  for (const method of ["select", "eq", "delete", "order", "in"]) q[method] = vi.fn(() => q);
  q.update = mocked.update.mockImplementation(() => q);
  q.maybeSingle = vi.fn(async () => ({ data, error: null }));
  return q;
};
const denied = (operation: Promise<unknown>) => operation.then(() => false, () => true);

beforeEach(() => {
  vi.resetAllMocks();
  mocked.remove.mockResolvedValue({ data: [], error: null });
  mocked.storageFrom.mockReturnValue({ remove: mocked.remove });
});

describe("S1 generated object deletion", () => {
  it.each([
    ["foreign PDF", { pdf_storage_path: B + "/" + GB + "/resume.pdf", docx_storage_path: null }],
    ["mixed own PDF and foreign DOCX", {
      pdf_storage_path: A + "/" + GA + "/resume.pdf", docx_storage_path: B + "/" + GB + "/resume.docx",
    }],
  ])("S1-DELETE rejects %s before any privileged removal", async (_label, paths) => {
    mocked.from.mockReturnValue(query({ id: GA, user_id: A, ...paths }));
    const rejected = await denied(atsResumeService.deleteGenerated(A, GA));
    expect(mocked.remove, "An owned generated row does not authorize a foreign object").not.toHaveBeenCalled();
    expect(rejected).toBe(true);
  });
});

describe("S2 protected derived fields at real service entry points", () => {
  it.each([{ atsScore: 100 }, { atsKeywords: ["fabricated-certified"] }])(
    "S2-ATS does not persist caller analysis claims %j", async (patch) => {
      mocked.from.mockReturnValue(query({ id: GA, user_id: A, ats_score: 30, ats_keywords: ["typescript"] }));
      await denied(atsResumeService.updateGenerated(A, GA, patch));
      for (const [written] of mocked.update.mock.calls) {
        expect(written).not.toHaveProperty("ats_score");
        expect(written).not.toHaveProperty("ats_keywords");
      }
    },
  );

  it("S2-PROGRESS does not persist a caller aggregate", async () => {
    mocked.from.mockReturnValue(query({ id: RM, user_id: A, progress_percentage: 0 }));
    await denied(roadmapService.update(A, RM, { title: "Allowed label", progressPercentage: 100 }));
    for (const [written] of mocked.update.mock.calls) expect(written).not.toHaveProperty("progress_percentage");
  });

  it("S2-EDITOR retains intended ATS content, role and version edits", async () => {
    const q = query({ id: GA, user_id: A });
    mocked.from.mockReturnValue(q);
    const content = { summary: "Truthful user-edited summary" };
    await atsResumeService.updateGenerated(A, GA, {
      targetRole: "Backend Engineer", versionName: "Reviewed", resumeContent: content,
    });
    expect(mocked.update).toHaveBeenCalledWith(expect.objectContaining({
      target_role: "Backend Engineer", version_name: "Reviewed", resume_content: content,
    }));
    expect(q.eq).toHaveBeenCalledWith("user_id", A);
  });

  it("S2-LABEL retains intended roadmap label and archive edits", async () => {
    const q = query({ id: RM, user_id: A });
    mocked.from.mockReturnValue(q);
    await roadmapService.update(A, RM, { title: "My learning plan", description: "Personal label", isActive: false });
    expect(mocked.update).toHaveBeenCalledWith({
      title: "My learning plan", description: "Personal label", is_active: false,
    });
    expect(q.eq).toHaveBeenCalledWith("user_id", A);
  });

  it.each(["pending", "completed", "skipped"] as const)(
    "S2-TASK retains owned task intent %s and server aggregate calculation", async (status) => {
      const roadmap = { id: RM, user_id: A, progress_percentage: 100 };
      const completedAt = "2026-11-04T00:00:00Z";
      const task = {
        id: taskId,
        roadmap_id: RM,
        week_id: "week-a",
        task_title: "Review weekly progress",
        quiz_skill: null,
        status: "completed",
        completed_at: completedAt as string | null,
        sort_order: 0,
      };
      const week = { id: "week-a", roadmap_id: RM, week_number: 1 };
      const filters: Array<[string, unknown]> = [];
      mocked.from.mockImplementation((table: string) => {
        const q: Record<string, any> = {};
        for (const method of ["select", "order", "in"]) q[method] = () => q;
        q.eq = (name: string, value: unknown) => { filters.push([name, value]); return q; };
        q.update = mocked.update.mockReturnValue(q);
        q.maybeSingle = async () => ({ data: table === "roadmaps" ? roadmap : task, error: null });
        q.then = (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: table === "roadmap_weeks" ? [week] : [task], error: null }).then(resolve);
        return q;
      });
      mocked.rpc.mockImplementation(async (_name, { p_status }: { p_status: string }) => {
        task.status = p_status;
        task.completed_at = p_status === "completed" ? completedAt : null;
        roadmap.progress_percentage = p_status === "completed" ? 100 : 0;
        return { data: true, error: null };
      });
      const result = await roadmapService.updateTaskStatus(A, RM, taskId, status);
      expect(result.progress_percentage).toBe(status === "completed" ? 100 : 0);
      expect(result.weeks[0].tasks[0].status).toBe(status);
      expect(result.weeks[0].tasks[0].completed_at).toBe(status === "completed" ? completedAt : null);
      expect(mocked.rpc).toHaveBeenCalledExactlyOnceWith("update_owned_roadmap_task", {
        p_user_id: A, p_roadmap_id: RM, p_task_id: taskId, p_status: status,
      });
      expect(mocked.update).not.toHaveBeenCalled();
      expect(filters).toContainEqual(["user_id", A]);
      expect(filters).toContainEqual(["roadmap_id", RM]);
    },
  );

  it("S2-PARENT rejects an unowned resume before creating a skill analysis", async () => {
    const profile = query({ id: A, onboarding_completed: true, skills: ["TypeScript"] });
    const resume = query(null); // Adapter reports no row matching actor A + foreign resume ID.
    mocked.from.mockImplementation((table: string) => table === "profiles" ? profile : resume);
    await expect(skillGapService.analyze(A, RM, GB)).rejects.toMatchObject({ code: "RESUME_NOT_FOUND" });
    expect(resume.eq).toHaveBeenCalledWith("id", GB);
    expect(resume.eq).toHaveBeenCalledWith("user_id", A);
    expect(mocked.from.mock.calls.map(([table]) => table)).not.toContain("skill_analyses");
    // This asserts service filters and stop-before-write, not SQL FK/RLS behavior.
  });
});
