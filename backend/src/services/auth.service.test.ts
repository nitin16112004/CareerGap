import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  signUp: vi.fn(),
  resend: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  from: vi.fn(),
  assertVerificationResendAllowed: vi.fn(),
  assertPasswordResetAllowed: vi.fn(),
}));

vi.mock("../config/env", () => ({ getEnv: () => ({ FRONTEND_URL: "http://localhost:5173" }) }));
vi.mock("../config/supabase", () => ({
  getSupabaseAnonClient: () => ({ auth: {
    signUp: mocked.signUp,
    resend: mocked.resend,
    resetPasswordForEmail: mocked.resetPasswordForEmail,
  } }),
  getSupabaseServiceClient: () => ({ from: mocked.from }),
}));
vi.mock("./auth-rate-limit.service", () => ({ authRateLimitService: {
  assertVerificationResendAllowed: mocked.assertVerificationResendAllowed,
  assertPasswordResetAllowed: mocked.assertPasswordResetAllowed,
} }));

import { authController } from "../controllers/auth.controller";
import { HttpError } from "../utils/http-error";
import { authService } from "./auth.service";

const signupInput = {
  fullName: "Test Account",
  email: "test@example.invalid",
  password: "Example-Test-Password8",
  confirmPassword: "Example-Test-Password8",
};

const testIp = "127.0.0.1";

beforeEach(() => {
  vi.resetAllMocks();
  mocked.assertVerificationResendAllowed.mockResolvedValue(undefined);
  mocked.assertPasswordResetAllowed.mockResolvedValue(undefined);
});

describe("Auth email requests", () => {
  it("reports a safe email failure for a failed signup and leaves profiles alone", async () => {
    mocked.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { status: 500, code: "unexpected_failure", message: "Error sending confirmation email: private provider details" },
    });

    const response = { status: vi.fn(), json: vi.fn() };
    const next = vi.fn();
    await authController.signup({ body: signupInput } as Request, response as unknown as Response, next);

    expect(next).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      statusCode: 502,
      code: "AUTH_EMAIL_DELIVERY_FAILED",
      message: "The email request could not be completed. Please try again later.",
    }));
    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
    expect(mocked.from).not.toHaveBeenCalled();
  });

  it("rejects an obfuscated duplicate signup before touching a profile", async () => {
    mocked.signUp.mockResolvedValue({ data: { user: { identities: [] }, session: null }, error: null });

    await expect(authService.signup(signupInput)).rejects.toMatchObject({ statusCode: 409, code: "AUTH_EMAIL_EXISTS" });
    expect(mocked.from).not.toHaveBeenCalled();
  });

  it("does not overwrite a profile when Supabase accepts a repeated unconfirmed signup", async () => {
    const userId = "pending-user";
    const existingProfile = {
      id: userId,
      email: signupInput.email,
      full_name: "Original Name",
      onboarding_completed: true,
      email_verified: false,
      role: "user",
    };
    mocked.signUp.mockResolvedValue({
      data: {
        user: { id: userId, email: signupInput.email, identities: [{ provider: "email" }] },
        session: null,
      },
      error: null,
    });
    const upsert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }) });
    const eq = vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: existingProfile, error: null }) });
    mocked.from.mockReturnValueOnce({ upsert }).mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq }) });

    await expect(authService.signup(signupInput)).resolves.toMatchObject({ profile: existingProfile, requiresVerification: true });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ id: userId }), { onConflict: "id", ignoreDuplicates: true });
    expect(eq).toHaveBeenCalledWith("id", userId);
  });

  it("uses conditional wording when Supabase accepts a resend request", async () => {
    mocked.resend.mockResolvedValue({ data: { user: null, session: null }, error: null });
    const response = { json: vi.fn() };
    const next = vi.fn();
    const request = { body: { email: signupInput.email }, ip: testIp } as Request;

    await authController.resendVerification(request, response as unknown as Response, next);

    expect(mocked.assertVerificationResendAllowed).toHaveBeenCalledWith(signupInput.email, testIp);
    expect(mocked.resend).toHaveBeenCalledWith({
      email: signupInput.email,
      type: "signup",
      options: { emailRedirectTo: "http://localhost:5173/verify-email" },
    });
    expect(response.json).toHaveBeenCalledExactlyOnceWith({
      success: true,
      message: "If this email has an unverified account, check its inbox and spam folder for a verification code.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("respects the application's verification resend rate limit before calling Supabase", async () => {
    mocked.assertVerificationResendAllowed.mockRejectedValue(new HttpError(429, "Please wait.", "AUTH_VERIFICATION_RATE_LIMITED"));

    await expect(authService.resendVerification(signupInput.email, testIp)).rejects.toMatchObject({
      statusCode: 429,
      code: "AUTH_VERIFICATION_RATE_LIMITED",
    });
    expect(mocked.resend).not.toHaveBeenCalled();
  });

  it("returns a retryable 429 if Supabase throttles OTP resend", async () => {
    mocked.resend.mockResolvedValue({ error: { status: 429, code: "over_email_send_rate_limit", message: "You can only request this after some time" } });

    await expect(authService.resendVerification(signupInput.email, testIp)).rejects.toMatchObject({
      statusCode: 429,
      code: "AUTH_EMAIL_RATE_LIMITED",
    });
  });

  it("returns an email failure quietly when Supabase cannot send a reset email", async () => {
    mocked.resetPasswordForEmail.mockResolvedValue({
      error: { status: 500, code: "unexpected_failure", message: "Error sending recovery email: private provider details" },
    });

    await expect(authService.forgotPassword({ email: signupInput.email }, testIp)).rejects.toMatchObject({
      statusCode: 502,
      code: "AUTH_EMAIL_DELIVERY_FAILED",
      message: "The email request could not be completed. Please try again later.",
    });
    expect(mocked.assertPasswordResetAllowed).toHaveBeenCalledWith(signupInput.email, testIp);
    expect(mocked.resetPasswordForEmail).toHaveBeenCalledWith(signupInput.email, { redirectTo: "http://localhost:5173/reset-password" });
  });
});
