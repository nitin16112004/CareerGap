import type { EventEmitter } from "node:events";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResumeJobData } from "../types/resume";

// Invoke the real callback registered by the exported worker without Redis.
// No production parsing/authorization code is replaced; only external adapters and result persistence.
const mocked = vi.hoisted(() => ({
  processor: undefined as undefined | ((job: { id: string; data: ResumeJobData }) => Promise<void>),
  from: vi.fn(), download: vi.fn(), info: vi.fn(), storageFrom: vi.fn(), save: vi.fn(), fail: vi.fn(), fetch: vi.fn(),
  readCountsAtDownload: [] as number[],
}));
vi.mock("bullmq", () => ({
  Worker: class {
    constructor(_name: string, processor: typeof mocked.processor) { mocked.processor = processor; }
    on() { return this; }
    async close() {}
  },
}));
vi.mock("../config/redis", () => ({ getBullMqConnection: () => ({}) }));
vi.mock("../config/env", () => ({ getEnv: () => ({
  AI_SERVICE_URL: "http://ai.invalid", AI_REQUEST_TIMEOUT_MS: 1000, SHUTDOWN_TIMEOUT_MS: 1000,
}) }));
vi.mock("../config/logger", () => ({ logger: { info: vi.fn(), error: vi.fn(), fatal: vi.fn() } }));
vi.mock("./dead-letter", () => ({ writeDeadLetter: vi.fn() }));
vi.mock("../config/supabase", () => ({
  getSupabaseStorageClient: () => ({ from: mocked.from, storage: { from: mocked.storageFrom } }),
}));
vi.mock("../services/resume.service", () => ({
  resumeService: { saveParsedResult: mocked.save, markProcessingFailed: mocked.fail },
}));

// Dynamic import allows exact removal of this module's process handlers after the suite.
const events = ["SIGINT", "SIGTERM", "uncaughtException", "unhandledRejection"] as const;
const emitter = process as EventEmitter;
const previous = new Map<string, ReturnType<typeof emitter.listeners>>();
let resumeProcessingWorker: unknown;
beforeAll(async () => {
  for (const event of events) previous.set(event, emitter.listeners(event));
  ({ resumeProcessingWorker } = await import("./resume-processing.worker"));
});
afterAll(() => {
  for (const event of events) {
    for (const listener of emitter.listeners(event)) {
      if (!previous.get(event)!.includes(listener)) emitter.removeListener(event, listener as (...args: any[]) => void);
    }
  }
});
afterEach(() => vi.unstubAllGlobals());

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const RA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const pathA = A + "/" + RA + ".pdf";
const pathB = B + "/" + RB + ".pdf";
const job = (patch: Partial<ResumeJobData> = {}): ResumeJobData => ({
  resumeId: RA, userId: A, storagePath: pathA, fileName: "owner-a.pdf", fileType: "application/pdf", ...patch,
});
const authoritative = (data: unknown) => {
  const q: Record<string, any> = {};
  for (const method of ["select", "eq", "limit"]) q[method] = vi.fn(() => q);
  q.maybeSingle = vi.fn(async () => ({ data, error: null }));
  q.single = q.maybeSingle;
  mocked.from.mockReturnValue(q);
};
const run = (data: ResumeJobData) => {
  if (!mocked.processor) throw new Error("Production worker callback was not captured");
  return mocked.processor({ id: "test-only-job", data });
};
const settled = (operation: Promise<unknown>) => operation.then(() => false, () => true);

beforeEach(() => {
  vi.clearAllMocks();
  mocked.readCountsAtDownload.length = 0;
  authoritative({ id: RA, user_id: A, storage_path: pathA, file_url: pathA, file_name: "owner-a.pdf",
    file_type: "application/pdf", parsing_status: "processing", file_size: 14 });
  mocked.download.mockImplementation(async () => {
    mocked.readCountsAtDownload.push(mocked.from.mock.calls.length);
    return { data: new Blob(["%PDF-1.7\nA sentinel"]), error: null };
  });
  mocked.info.mockResolvedValue({ data: { id: "object-a", name: pathA, bucketId: "resumes" }, error: null });
  mocked.storageFrom.mockReturnValue({ download: mocked.download, info: mocked.info });
  mocked.fetch.mockResolvedValue({ ok: true, json: async () => ({ data: { name: "Owner A", skills: [] } }) });
  mocked.save.mockResolvedValue(undefined);
  vi.stubGlobal("fetch", mocked.fetch);
});

describe("S1 real resume worker callback", () => {
  it("S1-WORKER rejects a queued B object before download or AI dispatch", async () => {
    const denied = await settled(run(job({ storagePath: pathB })));
    expect(mocked.download, "Poisoned queue path must not reach privileged download").not.toHaveBeenCalled();
    expect(mocked.fetch).not.toHaveBeenCalled();
    expect(mocked.save).not.toHaveBeenCalled();
    expect(denied).toBe(true);
  });

  it("S1-RELOAD reads authoritative database state before its first download", async () => {
    await run(job());
    expect(mocked.readCountsAtDownload).toHaveLength(1);
    expect(mocked.readCountsAtDownload[0], "A queued path is not authoritative database state").toBeGreaterThan(0);
  });

  it("refuses to download when Storage cannot verify the current file", async () => {
    mocked.info.mockResolvedValue({ data: null, error: null });
    expect(await settled(run(job()))).toBe(true);
    expect(mocked.download).not.toHaveBeenCalled();
    expect(mocked.fetch).not.toHaveBeenCalled();
  });

  it("S1-MISSING refuses download when the authoritative row is absent", async () => {
    authoritative(null);
    await settled(run(job()));
    expect(mocked.download).not.toHaveBeenCalled();
    expect(mocked.save).not.toHaveBeenCalled();
  });

  it("S1-STALE refuses a queued A key when current storage identity disagrees", async () => {
    authoritative({ id: RA, user_id: A, storage_path: pathB, file_type: "application/pdf" });
    await settled(run(job()));
    expect(mocked.download).not.toHaveBeenCalled();
    expect(mocked.save).not.toHaveBeenCalled();
  });

  it("S1-QUEUE-OWNER refuses a mismatched queued owner/resume pair", async () => {
    await settled(run(job({ userId: B, resumeId: RB })));
    expect(mocked.download).not.toHaveBeenCalled();
    expect(mocked.save).not.toHaveBeenCalled();
  });

  it("S1-WORKER-OWNER retains normal owner parsing dispatch (mock-adapter control)", async () => {
    expect(resumeProcessingWorker).toBeDefined();
    await run(job());
    expect(mocked.download).toHaveBeenCalledWith(pathA);
    expect(mocked.fetch).toHaveBeenCalledOnce();
    expect(mocked.save).toHaveBeenCalledWith(job(), { name: "Owner A", skills: [] });
  });
});
