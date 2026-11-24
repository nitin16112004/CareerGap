import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthCard } from "../../components/auth/AuthCard";
import { Button } from "../../components/auth/Button";
import { ErrorMessage } from "../../components/auth/FeedbackMessage";
import { googleRedirectKey } from "../../components/auth/GoogleSignIn";
import { useAuth } from "../../hooks/use-auth";
import { afterSignIn } from "../../lib/auth-routing";
import { supabase } from "../../lib/supabase";

export const AuthCallbackPage = (): JSX.Element => {
  const { search, hash } = useLocation();
  const navigate = useNavigate();
  const { user, profile, loading, profileLoadFailed, refreshAuth } = useAuth();
  const exchange = useRef<ReturnType<typeof supabase.auth.exchangeCodeForSession>>();
  const [signedInUserId, setSignedInUserId] = useState<string>();
  const [failed, setFailed] = useState(false);
  const params = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.slice(1));
  const code = params.get("code");
  const providerError = params.has("error") || params.has("error_code") || fragment.has("error") || fragment.has("error_code");

  useEffect(() => {
    if (!code || providerError) return;
    let active = true;
    exchange.current ??= supabase.auth.exchangeCodeForSession(code);
    void exchange.current.then(({ data, error }) => {
      if (!active) return;
      if (error || !data.session) setFailed(true);
      else setSignedInUserId(data.session.user.id);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [code, providerError]);

  useEffect(() => {
    if (!signedInUserId || loading || profileLoadFailed || user?.id !== signedInUserId) return;
    const redirect = sessionStorage.getItem(googleRedirectKey);
    sessionStorage.removeItem(googleRedirectKey);
    navigate(afterSignIn(profile, redirect), { replace: true });
  }, [loading, navigate, profile, profileLoadFailed, signedInUserId, user?.id]);

  if (!code || providerError || failed) {
    return <AuthCard title="Google sign-in did not finish" subtitle="Return to sign in and try again.">
      <ErrorMessage>The Google sign-in request was cancelled or expired.</ErrorMessage>
      <Link className="button button-primary" to="/login" replace>Return to sign in</Link>
    </AuthCard>;
  }

  if (signedInUserId && profileLoadFailed && !loading) {
    return <AuthCard title="Your profile is temporarily unavailable" subtitle="Your Google sign-in completed. Retry to continue.">
      <Button type="button" onClick={() => { void refreshAuth(); }}>Retry loading profile</Button>
    </AuthCard>;
  }

  return <AuthCard title="Finishing Google sign-in" subtitle="Preparing your account.">
    <p role="status">Loading your account…</p>
  </AuthCard>;
};
