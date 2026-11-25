import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({ from: vi.fn(), update: vi.fn(), fetch: vi.fn() }));
vi.mock("../config/supabase", () => ({ getSupabaseStorageClient: () => ({ from: mocked.from, rpc: vi.fn() }) }));
vi.mock("../config/redis", () => ({ connectRedis: vi.fn() }));
vi.mock("../jobs/queues", () => ({ createQueue: vi.fn() }));
vi.mock("../config/env", () => ({ getEnv: () => ({ AI_SERVICE_URL: "http://ai.invalid", AI_REQUEST_TIMEOUT_MS: 1000 }) }));
import { ragRoadmapService } from "./rag-roadmap.service";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const jobId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const analysisId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const chain = (data: unknown, table: string) => {
  const q: Record<string, any> = {};
  for (const key of ["select", "eq", "in", "order", "limit"]) q[key] = vi.fn(() => q);
  q.maybeSingle = vi.fn(async () => ({ data, error: null }));
  q.update = (patch: unknown) => { mocked.update(table, patch); return q; };
  q.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve);
  return q;
};
let jobRecord: Record<string, unknown> | null;
let jobQuery: Record<string, any>;
beforeEach(() => {
  vi.resetAllMocks();
  jobRecord = { id: jobId, user_id: B, job_type: "roadmap_rag", status: "queued",
    input_payload: {}, output_payload: {}, created_at: "2026-11-04T00:00:00Z" };
  jobQuery = chain(jobRecord, "ai_jobs");
  mocked.from.mockImplementation((table: string) => {
    if (table === "ai_jobs") return jobQuery;
    if (table === "profiles") return chain({ id: A, skills: ["TypeScript"], target_job_role: "Backend Engineer" }, table);
    if (table === "skill_analyses") return chain({
      id: analysisId, user_id: A, role_id: null, current_skills: ["TypeScript"],
      missing_skills: ["PostgreSQL"], matched_skills: [], recommended_skills: [],
    }, table);
    throw new Error("Unexpected relation in test: " + table);
  });
  // Deliberately block all real network. Failure classification below uses attempted job writes,
  // never this artificial provider error as evidence of an authorization denial.
  mocked.fetch.mockRejectedValue(new Error("TEST_NETWORK_BLOCKED"));
  vi.stubGlobal("fetch", mocked.fetch);
});
afterEach(() => vi.unstubAllGlobals());

describe("S2 RAG job state authority at the existing worker service entry", () => {
  it("S2-JOB-OWNER must not mutate B's job using queued A ownership", async () => {
    await expect(ragRoadmapService.process(jobId, A)).rejects.toMatchObject({ code: "RAG_JOB_NOT_FOUND" });
    expect(mocked.update.mock.calls.filter(([table]) => table === "ai_jobs"),
      "Job must be loaded and owner/type checked before changing status/output").toEqual([]);
    expect(mocked.fetch).not.toHaveBeenCalled();
  });

  it("S2-JOB-MISSING must not execute or update a nonexistent job", async () => {
    jobQuery = chain(null, "ai_jobs");
    await expect(ragRoadmapService.process(jobId, A)).rejects.toMatchObject({ code: "RAG_JOB_NOT_FOUND" });
    expect(mocked.update.mock.calls.filter(([table]) => table === "ai_jobs")).toEqual([]);
    expect(mocked.fetch).not.toHaveBeenCalled();
  });

  it("S2-JOB-READ retains owner and type filters in the polling API service", async () => {
    jobQuery = chain(null, "ai_jobs");
    await expect(ragRoadmapService.getJob(A, jobId)).rejects.toMatchObject({ code: "RAG_JOB_NOT_FOUND" });
    expect(jobQuery.eq).toHaveBeenCalledWith("id", jobId);
    expect(jobQuery.eq).toHaveBeenCalledWith("user_id", A);
    expect(jobQuery.eq).toHaveBeenCalledWith("job_type", "roadmap_rag");
    expect(mocked.update).not.toHaveBeenCalled();
  });

  it("runs a valid owned job using its stored request", async () => {
    jobQuery = chain({ ...jobRecord, user_id: A, input_payload: { skillAnalysisId: analysisId } }, "ai_jobs");

    await expect(ragRoadmapService.process(jobId, A)).rejects.toMatchObject({ code: "RAG_AI_SERVICE_UNAVAILABLE" });

    expect(mocked.update).toHaveBeenCalledExactlyOnceWith("ai_jobs", expect.objectContaining({ status: "processing" }));
    expect(jobQuery.eq).toHaveBeenCalledWith("user_id", A);
    expect(mocked.fetch).toHaveBeenCalledTimes(1);
  });

  it("does not run a completed owned job again", async () => {
    jobQuery = chain({ ...jobRecord, user_id: A, status: "completed" }, "ai_jobs");

    await expect(ragRoadmapService.process(jobId, A)).resolves.toBeUndefined();

    expect(mocked.update).not.toHaveBeenCalled();
    expect(mocked.fetch).not.toHaveBeenCalled();
  });
});
