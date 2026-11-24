import { useEffect, type PropsWithChildren } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/use-auth";
import { afterSignIn } from "../../lib/auth-routing";

export const SessionHandler = ({ children }: PropsWithChildren): JSX.Element => {
  const { loading, user, profile, profileLoadFailed } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user || profileLoadFailed) return;
    const path = location.pathname;
    const authEntry = path === "/login" || path === "/signup";
    const emailVerified = Boolean(user.email_confirmed_at || profile?.email_verified);
    if (authEntry && !emailVerified) {
      const redirect = new URLSearchParams(location.search).get("redirect");
      navigate("/verify-email", { replace: true, state: { email: user.email, redirect } });
      return;
    }
    if ((authEntry || path === "/verify-email") && emailVerified) {
      const redirect = path === "/verify-email"
        ? (location.state as { redirect?: string } | null)?.redirect
        : new URLSearchParams(location.search).get("redirect");
      navigate(afterSignIn(profile, redirect), { replace: true });
    }
  }, [loading, location.pathname, location.search, location.state, navigate, profile, profileLoadFailed, user]);

  return <>{children}</>;
};
