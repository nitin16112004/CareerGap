import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "./api";

vi.mock("../lib/supabase", () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("apiRequest", () => {
  it("rejects an HTML fallback served with a successful HTTP status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<!doctype html><title>CareerGuid</title>")));

    await expect(apiRequest("/auth/signup", { method: "POST" })).rejects.toMatchObject({ code: "INVALID_API_RESPONSE" });
  });

  it.each([200, 502])("rejects a structured email delivery failure with HTTP %i", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      success: false,
      message: "Unable to send the verification email.",
      errorCode: "AUTH_EMAIL_DELIVERY_FAILED",
    }, { status })));

    await expect(apiRequest("/auth/resend-verification", { method: "POST" })).rejects.toMatchObject({
      status,
      code: "AUTH_EMAIL_DELIVERY_FAILED",
      message: "Unable to send the verification email.",
    });
  });

  it("accepts an empty HTTP 204 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(apiRequest("/admin/skills/skill-id", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("waits for Render liveness before sending a signup exactly once", async () => {
    vi.stubEnv("VITE_API_URL", "https://career-test.onrender.com/api/v1");
    vi.resetModules();
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ status: "ok" }))
      .mockResolvedValueOnce(Response.json({ success: true, data: { requiresVerification: true } }, { status: 201 }));
    vi.stubGlobal("fetch", fetch);
    const hosted = await import("./api");
    await expect(hosted.apiRequest("/auth/signup", { method: "POST", body: "{}" }))
      .resolves.toEqual({ requiresVerification: true });
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      "https://career-test.onrender.com/api/health/live", "https://career-test.onrender.com/api/v1/auth/signup",
    ]);
    expect(hosted.apiIsStarting()).toBe(false);
  });
});
