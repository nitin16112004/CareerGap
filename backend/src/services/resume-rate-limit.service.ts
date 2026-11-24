import { createHash } from "node:crypto";
import { connectRedis } from "../config/redis";
import { HttpError } from "../utils/http-error";
import { RESUME_UPLOAD_LIMIT_PER_USER, RESUME_UPLOAD_WINDOW_SECONDS } from "../types/resume";

const ATS_GENERATION_LIMIT_PER_USER = 10;
const ATS_GENERATION_WINDOW_SECONDS = 24 * 60 * 60;

const rateLimitExceeded = async (userId: string, operation: string, limit: number, windowSeconds: number): Promise<boolean> => {
  try {
    const redis = await connectRedis();
    const key = `${operation}:${createHash("sha256").update(userId).digest("hex")}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSeconds);
    return count > limit;
  } catch {
    // Redis is an optional local dependency; the API remains usable during local
    // development while production deployments should monitor Redis health.
    return false;
  }
};

export const assertResumeUploadAllowed = async (userId: string): Promise<void> => {
  if (await rateLimitExceeded(userId, "resume-upload", RESUME_UPLOAD_LIMIT_PER_USER, RESUME_UPLOAD_WINDOW_SECONDS)) {
    throw new HttpError(429, "Resume upload limit reached. Please try again later.", "RESUME_UPLOAD_RATE_LIMITED");
  }
};

export const assertAtsGenerationAllowed = async (userId: string): Promise<void> => {
  if (await rateLimitExceeded(userId, "ats-generate", ATS_GENERATION_LIMIT_PER_USER, ATS_GENERATION_WINDOW_SECONDS)) {
    throw new HttpError(429, "Daily ATS resume generation limit reached. Please try again later.", "ATS_RESUME_RATE_LIMITED");
  }
};
