import { act, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { AuthCallbackPage } from "./AuthCallbackPage";

const { exchangeCodeForSession } = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn() }));

vi.mock("../../lib/supabase", () => ({ supabase: { auth: { exchangeCodeForSession } } }));
vi.mock("../../hooks/use-auth", () => ({
  useAuth: () => ({
    loading: false,
    profileLoadFailed: false,
    user: { id: "user-1" },
    profile: { onboarding_completed: true, role: "user" },
  }),
}));

it("exchanges a Google authorization code once and opens the returning user's dashboard", async () => {
  exchangeCodeForSession.mockResolvedValue({ data: { session: { user: { id: "user-1" } } }, error: null });
  await act(async () => {
    render(
      <StrictMode>
        <MemoryRouter initialEntries={["/auth/callback?code=authorization-code"]}>
          <Routes>
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/dashboard" element={<h1>Dashboard destination</h1>} />
          </Routes>
        </MemoryRouter>
      </StrictMode>,
    );
  });

  expect(await screen.findByRole("heading", { name: "Dashboard destination" })).toBeInTheDocument();
  expect(exchangeCodeForSession).toHaveBeenCalledExactlyOnceWith("authorization-code");
});
