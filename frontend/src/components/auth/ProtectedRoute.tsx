import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/use-auth";
import { FullPageLoader } from "../layout/FullPageLoader";
import { AuthCard } from "./AuthCard";
import { Button } from "./Button";

export const ProtectedRoute = (): JSX.Element => {
  const { loading, user, profile, profileLoadFailed, refreshAuth } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoader label="Restoring your secure session..." />;
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}`} replace />;

  const isOnboardingRoute = location.pathname.startsWith("/onboarding");
  const isAdminRoute = location.pathname.startsWith("/admin");
  const emailVerified = Boolean(user.email_confirmed_at || profile?.email_verified);

  if (!emailVerified) return <Navigate to="/verify-email" replace />;
  if (profileLoadFailed) return (
    <main className="onboarding-shell">
      <AuthCard title="Your profile is temporarily unavailable" subtitle="Retry to continue to your workspace.">
        <Button type="button" onClick={() => { void refreshAuth(); }}>Retry loading profile</Button>
      </AuthCard>
    </main>
  );
  if (isAdminRoute && profile?.role !== "admin") return <Navigate to="/dashboard" replace />;
  if (!isAdminRoute && !isOnboardingRoute && !profile?.onboarding_completed) return <Navigate to="/onboarding/upload-resume" replace />;

  return <Outlet />;
};
