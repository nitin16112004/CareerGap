import { useState } from "react";
import { safeRedirect } from "../../lib/auth-routing";
import { supabase } from "../../lib/supabase";
import { LoadingButton } from "./Button";
import { ErrorMessage } from "./FeedbackMessage";

export const googleRedirectKey = "careerguid:google-redirect";

export const GoogleSignIn = ({ redirect, disabled }: { redirect?: string | null; disabled?: boolean }): JSX.Element => {
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const start = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const returnPath = safeRedirect(redirect);
      if (returnPath) sessionStorage.setItem(googleRedirectKey, returnPath);
      else sessionStorage.removeItem(googleRedirectKey);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: new URL("/auth/callback", window.location.origin).href },
      });
      if (error) throw error;
    } catch {
      setFailed(true);
      setLoading(false);
    }
  };

  return <>
    {failed && <ErrorMessage>Google sign-in could not start. Please try again.</ErrorMessage>}
    <LoadingButton type="button" variant="secondary" loading={loading} disabled={disabled} loadingLabel="Opening Google…" onClick={() => { void start(); }}>
      Continue with Google
    </LoadingButton>
  </>;
};
