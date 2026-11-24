import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthContext } from "../../hooks/use-auth";
import { ApiError } from "../../services/api";
import { LoginPage } from "./LoginPage";
import { SignupPage } from "./SignupPage";
import { VerifyEmailPage } from "./VerifyEmailPage";

const mocked = vi.hoisted(() => ({
  login: vi.fn(),
  signup: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerification: vi.fn(),
}));

vi.mock("../../services/auth.service", () => ({
  authService: { login: mocked.login, signup: mocked.signup, verifyEmail: mocked.verifyEmail, resendVerification: mocked.resendVerification },
}));

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

const renderLogin = (entry = "/login") => render(
  <MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/verify-email" element={<div>VERIFY_EMAIL_TARGET</div>} />
      <Route path="/onboarding/upload-resume" element={<div>ONBOARDING_TARGET</div>} />
      <Route path="/dashboard" element={<div>DASHBOARD_TARGET</div>} />
    </Routes>
  </MemoryRouter>,
);

const renderSignup = () => render(
  <MemoryRouter initialEntries={["/signup"]}>
    <Routes>
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/verify-email" element={<div>VERIFY_EMAIL_TARGET</div>} />
      <Route path="/onboarding/upload-resume" element={<div>ONBOARDING_TARGET</div>} />
    </Routes>
  </MemoryRouter>,
);

const renderVerifyEmail = (email: string | null = "user@example.com") => render(
  <AuthContext.Provider value={{ session: null, user: null, profile: null, loading: false, refreshAuth: vi.fn(), signOut: vi.fn() }}>
    <MemoryRouter initialEntries={[{ pathname: "/verify-email", state: email ? { email } : null }]}>
      <Routes>
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/onboarding/upload-resume" element={<div>ONBOARDING_TARGET</div>} />
      </Routes>
    </MemoryRouter>
  </AuthContext.Provider>,
);

describe("LoginPage", () => {
  it("validates email and password before calling the auth service", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText("Email address"), "not-an-email");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.getByText("Enter your password")).toBeInTheDocument();
    expect(mocked.login).not.toHaveBeenCalled();
  });

  it("routes unverified users to email verification", async () => {
    mocked.login.mockResolvedValue({ requiresVerification: true });
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText("Email address"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("VERIFY_EMAIL_TARGET")).toBeInTheDocument();
    expect(mocked.login).toHaveBeenCalledWith({ email: "user@example.com", password: "password123" });
  });

  it("honours the protected-route redirect after a verified login", async () => {
    mocked.login.mockResolvedValue({ requiresVerification: false });
    const user = userEvent.setup();
    renderLogin("/login?redirect=%2Fdashboard");

    await user.type(screen.getByLabelText("Email address"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("DASHBOARD_TARGET")).toBeInTheDocument();
  });

  it("opens the dashboard by default for a verified user who completed onboarding", async () => {
    mocked.login.mockResolvedValue({ requiresVerification: false, profile: { role: "user", onboarding_completed: true } });
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText("Email address"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("DASHBOARD_TARGET")).toBeInTheDocument();
  });
});

describe("SignupPage", () => {
  it("blocks mismatched passwords client-side", async () => {
    const user = userEvent.setup();
    renderSignup();

    await user.type(screen.getByLabelText("Full name"), "Ava Stone");
    await user.type(screen.getByLabelText("Email address"), "ava@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm password"), "different123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(mocked.signup).not.toHaveBeenCalled();
  });

  it("stores the verification email when signup requires confirmation", async () => {
    mocked.signup.mockResolvedValue({ session: null, requiresVerification: true });
    const user = userEvent.setup();
    renderSignup();

    await user.type(screen.getByLabelText("Full name"), "Ava Stone");
    await user.type(screen.getByLabelText("Email address"), "ava@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm password"), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText("VERIFY_EMAIL_TARGET")).toBeInTheDocument();
    expect(sessionStorage.getItem("careerguid:verification-email")).toBe("ava@example.com");
    expect(mocked.signup).toHaveBeenCalledWith(expect.objectContaining({ fullName: "Ava Stone", email: "ava@example.com" }));
  });

  it.each([
    { failed: true, message: "Unable to send the verification email. Please try again." },
    { failed: false, message: "We couldn't confirm the signup request. Please try again." },
  ])("stays on signup when verification is not available ($failed)", async ({ failed, message }) => {
    if (failed) mocked.signup.mockRejectedValueOnce(new ApiError(message, 502, "AUTH_EMAIL_DELIVERY_FAILED"));
    else mocked.signup.mockResolvedValueOnce({ session: null });
    const user = userEvent.setup();
    renderSignup();

    await user.type(screen.getByLabelText("Full name"), "Ava Stone");
    await user.type(screen.getByLabelText("Email address"), "ava@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm password"), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByText("VERIFY_EMAIL_TARGET")).not.toBeInTheDocument();
    expect(sessionStorage.getItem("careerguid:verification-email")).toBeNull();
  });

  it("continues directly to onboarding when signup returns a session", async () => {
    mocked.signup.mockResolvedValue({ session: { access_token: "token" } });
    const user = userEvent.setup();
    renderSignup();

    await user.type(screen.getByLabelText("Full name"), "Ava Stone");
    await user.type(screen.getByLabelText("Email address"), "ava@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm password"), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(screen.getByText("ONBOARDING_TARGET")).toBeInTheDocument());
  });
});

describe("VerifyEmailPage", () => {
  it("reports a failed resend and only acknowledges an accepted request conditionally", async () => {
    const failure = "Unable to send the verification email. Please try again.";
    mocked.resendVerification.mockRejectedValueOnce(new ApiError(failure, 502, "AUTH_EMAIL_DELIVERY_FAILED")).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderVerifyEmail();

    const resend = screen.getByRole("button", { name: /resend verification email/i });
    await user.click(resend);

    expect(await screen.findByRole("alert")).toHaveTextContent(failure);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(resend).toBeEnabled();

    await user.click(resend);

    expect(await screen.findByRole("status")).toHaveTextContent("If this address needs verification, check your inbox and spam folder for a new code.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(resend).toBeDisabled();
    expect(mocked.resendVerification).toHaveBeenLastCalledWith("user@example.com");
  });

  it("supports resending after opening the verify page without a saved email", async () => {
    mocked.resendVerification.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderVerifyEmail(null);

    const resend = screen.getByRole("button", { name: /resend verification email/i });
    await user.click(resend);

    expect(await screen.findByRole("alert")).toHaveTextContent("Enter the email address you used to sign up.");
    expect(mocked.resendVerification).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Email address"), "user@example.com");
    await user.click(resend);

    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(mocked.resendVerification).toHaveBeenCalledWith("user@example.com");
  });

  it.each(["012345", "01234567", "0123456789"])("submits the complete verification code %s", async (token) => {
    mocked.verifyEmail.mockResolvedValue({ profile: null });
    const user = userEvent.setup();
    renderVerifyEmail();

    await user.type(screen.getByLabelText("Verification code"), token);
    await user.click(screen.getByRole("button", { name: /verify email/i }));

    expect(await screen.findByText("ONBOARDING_TARGET")).toBeInTheDocument();
    expect(mocked.verifyEmail).toHaveBeenCalledWith({ email: "user@example.com", token });
  });

  it.each(["12345", "1234a678"])("rejects invalid verification code %s before submitting", async (token) => {
    const user = userEvent.setup();
    renderVerifyEmail();

    await user.type(screen.getByLabelText("Verification code"), token);
    await user.click(screen.getByRole("button", { name: /verify email/i }));

    expect(await screen.findByText("Enter the 6- to 10-digit code from your email")).toBeInTheDocument();
    expect(mocked.verifyEmail).not.toHaveBeenCalled();
  });
});
