import { beforeEach, expect, it, vi } from "vitest";

const redis = vi.hoisted(() => ({ incr: vi.fn(), expire: vi.fn() }));
vi.mock("../config/redis", () => ({ connectRedis: () => redis }));

import { assertAtsGenerationAllowed, assertResumeUploadAllowed } from "./resume-rate-limit.service";

beforeEach(() => {
  vi.resetAllMocks();
  redis.expire.mockResolvedValue(true);
});

it("tracks ATS generations separately from resume uploads in a 24-hour user window", async () => {
  redis.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(1).mockResolvedValueOnce(10).mockResolvedValueOnce(11);

  await expect(assertResumeUploadAllowed("user-1")).resolves.toBeUndefined();
  await expect(assertAtsGenerationAllowed("user-1")).resolves.toBeUndefined();
  await expect(assertAtsGenerationAllowed("user-1")).resolves.toBeUndefined();
  await expect(assertAtsGenerationAllowed("user-1")).rejects.toMatchObject({ statusCode: 429, code: "ATS_RESUME_RATE_LIMITED" });

  expect(redis.expire).toHaveBeenNthCalledWith(1, expect.stringMatching(/^resume-upload:/), 3600);
  expect(redis.expire).toHaveBeenNthCalledWith(2, expect.stringMatching(/^ats-generate:/), 86400);
  expect(redis.expire).toHaveBeenCalledTimes(2);
});
