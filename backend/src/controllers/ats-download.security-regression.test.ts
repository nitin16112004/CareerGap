import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({ requireFeature: vi.fn(), exportGenerated: vi.fn() }));
vi.mock("../services/billing.service", () => ({ billingService: { requireFeature: mocked.requireFeature } }));
vi.mock("../services/ats-resume.service", () => ({ atsResumeService: { exportGenerated: mocked.exportGenerated } }));
import { atsResumeController } from "./ats-resume.controller";
import { HttpError } from "../utils/http-error";

const A = "11111111-1111-4111-8111-111111111111";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
beforeEach(() => {
  vi.resetAllMocks();
  mocked.exportGenerated.mockResolvedValue({ format: "pdf", url: "https://signed.invalid/test-only" });
});

describe("S2 paid export controller gate (not direct Storage authorization)", () => {
  it.each(["pdf", "docx"] as const)("S2-PAID blocks %s export before calling the export service", async (format) => {
    const error = new HttpError(402, "Upgrade required", "PLAN_UPGRADE_REQUIRED");
    mocked.requireFeature.mockRejectedValue(error);
    const req = { user: { userId: A }, params: { generatedResumeId: id } } as unknown as Request;
    const json = vi.fn();
    const next = vi.fn();
    await (format === "pdf" ? atsResumeController.exportPdf : atsResumeController.exportDocx)(
      req, { json } as unknown as Response, next as NextFunction,
    );
    expect(mocked.requireFeature).toHaveBeenCalledWith(A, "ats_download");
    expect(mocked.exportGenerated).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(error);
  });

  it.each(["pdf", "docx"] as const)("S2-PAID-OWNER retains paid %s export dispatch", async (format) => {
    mocked.requireFeature.mockResolvedValue({ plan_slug: "pro" });
    const req = { user: { userId: A }, params: { generatedResumeId: id } } as unknown as Request;
    const json = vi.fn();
    const next = vi.fn();
    await (format === "pdf" ? atsResumeController.exportPdf : atsResumeController.exportDocx)(
      req, { json } as unknown as Response, next as NextFunction,
    );
    expect(mocked.exportGenerated).toHaveBeenCalledWith(A, id, format);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(next).not.toHaveBeenCalled();
  });
});
