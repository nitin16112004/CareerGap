import type { Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateRoadmap } from "./roadmap.controller";
import { ragRoadmapService } from "../services/rag-roadmap.service";

const mocked = vi.hoisted(() => ({
  fetch: vi.fn(),
  from: vi.fn(),
  requireFeature: vi.fn(),
  consume: vi.fn(),
  generate: vi.fn(),
}));

vi.mock("../config/env", () => ({ getEnv: () => ({ AI_SERVICE_URL: "http://ai-service:8000", HEALTHCHECK_TIMEOUT_MS: 100 }) }));
vi.mock("../config/redis", () => ({ connectRedis: vi.fn() }));
vi.mock("../config/supabase", () => ({ getSupabaseStorageClient: () => ({ from: mocked.from }) }));
vi.mock("../jobs/queues", () => ({ createQueue: vi.fn() }));
vi.mock("../services/billing.service", () => ({ billingService: { requireFeature: mocked.requireFeature, consume: mocked.consume } }));
vi.mock("../services/roadmap.service", () => ({ roadmapService: { generate: mocked.generate } }));
vi.mock("../services/roadmap-progress.service", () => ({ roadmapProgressService: {} }));

const setup = (generationMode: "basic_template" | "rag") => {
  const request = { auth: { userId: "user-1" }, body: { generationMode } } as Request;
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const response = { status } as unknown as Response;
  return { next: vi.fn(), status, json, request, response };
};

const mockIndexLookup = (ids: string[]) => {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: ids.map((id) => ({ id })), error: null }),
  };
  mocked.from.mockReturnValue(query);
  return query;
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", mocked.fetch);
  mocked.fetch.mockResolvedValue(Response.json({ embedding_configured: true, llm_configured: true }));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("AI roadmap readiness", () => {
  it("rejects missing provider configuration before checking the index or consuming usage", async () => {
    mocked.fetch.mockResolvedValue(Response.json({ embedding_configured: true, llm_configured: false }));
    const { request, response, next } = setup("rag");

    await generateRoadmap(request, response, next);

    expect(mocked.requireFeature).toHaveBeenCalledWith("user-1", "advanced_roadmap");
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: "RAG_PROVIDER_NOT_CONFIGURED", statusCode: 503, expose: true }));
    expect(mocked.consume).not.toHaveBeenCalled();
    expect(mocked.from).not.toHaveBeenCalled();
  });

  it("rejects an empty index before reserving usage", async () => {
    const index = mockIndexLookup([]);
    const { request, response, next } = setup("rag");

    await generateRoadmap(request, response, next);

    expect(mocked.from).toHaveBeenCalledWith("knowledge_base_documents");
    expect(index.eq).toHaveBeenCalledWith("is_active", true);
    expect(index.not).toHaveBeenCalledWith("embedding", "is", null);
    expect(index.limit).toHaveBeenCalledWith(1);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: "RAG_KNOWLEDGE_BASE_NOT_READY", statusCode: 503, expose: true }));
    expect(mocked.consume).not.toHaveBeenCalled();
  });

  it("reports AI-service connectivity failures before charging usage", async () => {
    mocked.fetch.mockRejectedValue(new Error("internal network failure"));
    const { request, response, next } = setup("rag");

    await generateRoadmap(request, response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: "RAG_AI_SERVICE_UNAVAILABLE", statusCode: 503, expose: true }));
    expect(mocked.consume).not.toHaveBeenCalled();
  });

  it("allows a ready AI roadmap request to reserve usage and reach the queue", async () => {
    mockIndexLookup(["document-1"]);
    mocked.consume.mockResolvedValue(true);
    const job = { id: "job-1", status: "queued", errorMessage: null, roadmapId: null, createdAt: "2026-11-22T00:00:00Z", completedAt: null } as const;
    const enqueue = vi.spyOn(ragRoadmapService, "enqueue").mockResolvedValue(job);
    const { request, response, next, status, json } = setup("rag");

    await generateRoadmap(request, response, next);

    expect(next).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledWith("user-1", expect.objectContaining({ generationMode: "rag" }), true);
    expect(status).toHaveBeenCalledWith(202);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ data: job }));
  });

  it("generates basic plans without checking AI providers or the knowledge base", async () => {
    const { request, response, next, status } = setup("basic_template");

    await generateRoadmap(request, response, next);

    expect(next).not.toHaveBeenCalled();
    expect(mocked.fetch).not.toHaveBeenCalled();
    expect(mocked.from).not.toHaveBeenCalled();
    expect(mocked.generate).toHaveBeenCalledWith("user-1", expect.objectContaining({ generationMode: "basic_template" }));
    expect(status).toHaveBeenCalledWith(201);
  });
});
