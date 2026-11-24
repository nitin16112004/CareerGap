import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvForTests } from "../config/env";

const baseEnv = {
  FRONTEND_URL: "http://localhost:5173",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  REDIS_URL: "redis://localhost:6379",
  AI_SERVICE_URL: "http://localhost:8000",
};

let emailService: typeof import("./email.service").emailService;

const setBaseEnv = (): void => {
  for (const [key, value] of Object.entries(baseEnv)) vi.stubEnv(key, value);
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("EMAIL_PROVIDER", "console");
  vi.stubEnv("EMAIL_PROVIDER_API_KEY", "");
  vi.stubEnv("EMAIL_FROM", "");
  resetEnvForTests();
};

beforeAll(async () => {
  setBaseEnv();
  ({ emailService } = await import("./email.service"));
});

beforeEach(() => {
  setBaseEnv();
});

afterAll(() => {
  vi.unstubAllEnvs();
  resetEnvForTests();
});

describe("emailService reminder delivery", () => {
  it("allows console delivery only in non-production environments", async () => {
    const result = await emailService.sendTransactional({
      to: "user@example.com",
      subject: "Reminder",
      html: "<p>Reminder</p>",
      text: "Reminder",
    });

    expect(result.provider).toBe("console");
    expect(result.providerMessageId).toMatch(/^console-/);
  });

  it("fails closed when production is configured with the console provider", async () => {
    vi.stubEnv("NODE_ENV", "production");
    resetEnvForTests();

    await expect(emailService.sendTransactional({
      to: "user@example.com",
      subject: "Reminder",
      html: "<p>Reminder</p>",
      text: "Reminder",
    })).rejects.toMatchObject({
      code: "EMAIL_PROVIDER_NOT_CONFIGURED",
      statusCode: 503,
    });
  });

  it("requires transactional provider credentials before calling the network", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    resetEnvForTests();

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(emailService.sendTransactional({
      to: "user@example.com",
      subject: "Reminder",
      html: "<p>Reminder</p>",
      text: "Reminder",
    })).rejects.toMatchObject({ code: "EMAIL_PROVIDER_NOT_CONFIGURED" });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("passes a stable idempotency key to the transactional provider", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("EMAIL_PROVIDER_API_KEY", "re_test_key");
    vi.stubEnv("EMAIL_FROM", "CareerGuid AI <reminders@example.com>");
    resetEnvForTests();

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "email-123" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    const result = await emailService.sendTransactional({
      to: "user@example.com",
      subject: "Reminder",
      html: "<p>Reminder</p>",
      text: "Reminder",
      idempotencyKey: "reminder/reminder-log-123",
    });

    expect(result).toEqual({ provider: "resend", providerMessageId: "email-123" });
    const request = fetchSpy.mock.calls[0]?.[1];
    expect(request?.headers).toMatchObject({ "idempotency-key": "reminder/reminder-log-123" });
    fetchSpy.mockRestore();
  });

  it("uses the Gmail API with a sender grant, without Resend credentials", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "gmail");
    vi.stubEnv("GMAIL_SENDER", "sender@example.com");
    vi.stubEnv("GMAIL_CLIENT_ID", "fixture-client");
    vi.stubEnv("GMAIL_CLIENT_SECRET", "fixture-secret");
    vi.stubEnv("GMAIL_REFRESH_TOKEN", "fixture-refresh");
    resetEnvForTests();
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ access_token: "fixture-access", expires_in: 3600 }))
      .mockResolvedValueOnce(Response.json({ id: "gmail-message-id" }));
    try {
      const result = await emailService.sendTransactional({
        to: "recipient@example.com",
        subject: "CareerGuid reminder",
        text: "Review your roadmap",
        html: "<p>Review your roadmap</p>",
        idempotencyKey: "reminder/fixture",
      });
      expect(result).toEqual({ provider: "gmail", providerMessageId: "gmail-message-id" });
      expect(fetchSpy.mock.calls[0]?.[0]).toBe("https://oauth2.googleapis.com/token");
      expect(fetchSpy.mock.calls[1]?.[0]).toBe("https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
      const request = fetchSpy.mock.calls[1]?.[1];
      expect(request?.headers).toMatchObject({ authorization: "Bearer fixture-access" });
      const message = Buffer.from(JSON.parse(String(request?.body)).raw, "base64url").toString();
      expect(message).toContain("To: recipient@example.com\r\n");
      expect(message).toContain("multipart/alternative");
      expect(message).toContain("Content-Type: text/html; charset=UTF-8");
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
