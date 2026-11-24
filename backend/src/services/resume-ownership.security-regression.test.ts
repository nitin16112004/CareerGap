import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResumeRecord } from "../types/resume";

// Only external adapters are mocked. The real service chooses whether to sign/enqueue.
// These fixtures do not execute SQL policies or certify a managed Storage object.
const mocked = vi.hoisted(() => ({
  from: vi.fn(), storageFrom: vi.fn(), sign: vi.fn(), upload: vi.fn(),
  remove: vi.fn(), info: vi.fn(), queueAdd: vi.fn(), rateLimit: vi.fn(),
}));
vi.mock("../config/supabase", () => ({
  getSupabaseStorageClient: () => ({ from: mocked.from, storage: { from: mocked.storageFrom } }),
}));
vi.mock("../jobs/queues", () => ({ createQueue: () => ({ add: mocked.queueAdd }) }));
vi.mock("./resume-rate-limit.service", () => ({ assertResumeUploadAllowed: mocked.rateLimit }));
import { resumeService } from "./resume.service";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const RA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const pathA = A + "/" + RA + ".pdf";
const pathB = B + "/" + RB + ".pdf";
const row = (patch: Record<string, unknown> = {}): ResumeRecord => ({
  id: RA, user_id: A, file_name: "owner-a.pdf", file_url: pathA, storage_path: pathA,
  file_type: "application/pdf", file_size: 14, extracted_text: null, extracted_data: {},
  extracted_skills: [], parsing_status: "pending", parsing_error: null, is_active: true,
  created_at: "2026-11-04T00:00:00Z", updated_at: "2026-11-04T00:00:00Z", ...patch,
} as ResumeRecord);
const query = (data: unknown) => {
  const chain: Record<string, any> = {};
  for (const key of ["select", "eq", "neq", "insert", "update"]) chain[key] = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => ({ data, error: null }));
  chain.single = vi.fn(async () => ({ data, error: null }));
  return chain;
};
const rejected = (operation: Promise<unknown>): Promise<boolean> =>
  operation.then(() => false, () => true);

beforeEach(() => {
  vi.resetAllMocks();
  mocked.sign.mockResolvedValue({ data: { signedUrl: "https://signed.invalid/test-only" }, error: null });
  mocked.upload.mockResolvedValue({ data: {}, error: null });
  mocked.remove.mockResolvedValue({ data: [], error: null });
  mocked.queueAdd.mockResolvedValue({});
  mocked.rateLimit.mockResolvedValue(undefined);
  mocked.info.mockResolvedValue({ data: { id: "object-a", version: "v1", name: pathA, bucketId: "resumes", size: 14, contentType: "application/pdf" }, error: null });
  mocked.storageFrom.mockReturnValue({ info: mocked.info, createSignedUrl: mocked.sign, upload: mocked.upload, remove: mocked.remove });
});

describe("S1 resume service storage authority", () => {
  it.each([
    ["foreign user object", { storage_path: pathB }],
    ["missing path", { storage_path: null }],
    ["empty path", { storage_path: "" }],
    ["wrong resume identity in own folder", { storage_path: A + "/" + RB + ".pdf" }],
    ["extra path segment", { storage_path: A + "/extra/" + RA + ".pdf" }],
    ["dot segment", { storage_path: A + "/../" + B + "/" + RB + ".pdf" }],
    ["encoded separator", { storage_path: A + "%2f" + RA + ".pdf" }],
    ["backslash path", { storage_path: A + "\\" + RA + ".pdf" }],
    ["external URL", { storage_path: "https://files.invalid/private.pdf" }],
    ["MIME and extension mismatch", { file_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }],
    ["inconsistent compatibility path", { file_url: pathB }],
  ])("S1-SIGN rejects %s before signing", async (_name, patch) => {
    mocked.from.mockReturnValue(query(row(patch)));
    const denied = await rejected(resumeService.get(A, RA));
    expect(mocked.sign, "Untrusted identity must not reach the service-role signer").not.toHaveBeenCalled();
    expect(denied).toBe(true);
  });

  it.each([
    ["missing object identity", { data: null, error: null }],
    ["metadata lookup failure", { data: null, error: new Error("TEST_METADATA_UNAVAILABLE") }],
    ["mismatched object name", { data: { id: "object-b", version: "v1", name: pathB, bucketId: "resumes" }, error: null }],
  ])("S1-VERIFY fails closed on %s despite a well-shaped database path", async (_label, metadata) => {
    mocked.from.mockReturnValue(query(row()));
    mocked.info.mockResolvedValue(metadata);
    const blocked = await rejected(resumeService.get(A, RA));
    expect(mocked.sign, "A plausible database key alone does not verify the object").not.toHaveBeenCalled();
    expect(blocked).toBe(true);
  });

  it.each(["pending", "processing", "completed"] as const)(
    "S1-PROCESS rejects a foreign path in the %s branch", async (parsing_status) => {
      mocked.from.mockReturnValue(query(row({ storage_path: pathB, parsing_status })));
      const denied = await rejected(resumeService.process(A, RA));
      expect(mocked.queueAdd, "Foreign path must not be copied into a parsing job").not.toHaveBeenCalled();
      expect(mocked.sign, "Fast paths must also validate storage authority").not.toHaveBeenCalled();
      expect(denied).toBe(true);
    },
  );

  it("S1-LOOKUP rejects a missing owned row without signing", async () => {
    const q = query(null);
    mocked.from.mockReturnValue(q);
    await expect(resumeService.get(A, RB)).rejects.toMatchObject({ code: "RESUME_NOT_FOUND" });
    expect(q.eq).toHaveBeenCalledWith("id", RB);
    expect(q.eq).toHaveBeenCalledWith("user_id", A);
    expect(mocked.sign).not.toHaveBeenCalled();
  });

  it("S1-OWNER preserves signing of a coherent owned row (adapter-level control)", async () => {
    mocked.from.mockReturnValue(query(row()));
    expect(await resumeService.get(A, RA)).toMatchObject({ id: RA, signed_url: "https://signed.invalid/test-only" });
    expect(mocked.storageFrom).toHaveBeenCalledWith("resumes");
    expect(mocked.sign).toHaveBeenCalledWith(pathA, 900);
    // This is not proof of a verified manifest: the production manifest does not exist yet.
  });

  it("S1-UPLOAD derives the object key from actor/allocated ID, not the submitted filename", async () => {
    const inserted = query(null);
    inserted.single.mockImplementation(async () => ({ data: inserted.insert.mock.calls[0][0], error: null }));
    mocked.from.mockReturnValueOnce(inserted).mockReturnValueOnce(query(null));
    const buffer = Buffer.from("%PDF-1.7\nowner-a");
    const file = {
      buffer, size: buffer.length, originalname: "../../owner-b.pdf", mimetype: "application/pdf",
    } as Express.Multer.File;
    const result = await resumeService.upload(A, file);
    const key = mocked.upload.mock.calls[0][0] as string;
    expect(key).toBe(A + "/" + result.id + ".pdf");
    expect(key).not.toContain("..");
    expect(mocked.upload).toHaveBeenCalledWith(key, buffer, expect.objectContaining({ upsert: false }));
    expect(inserted.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: A, storage_path: key }));
  });
});
