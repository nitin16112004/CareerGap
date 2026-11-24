import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { emailLinkSessionReady, supabase } from "../../lib/supabase";
import { authService } from "../../services/auth.service";
import type { AuthProfile } from "../../types/auth";
import { AuthContext } from "../../hooks/use-auth";

export const AuthProvider = ({ children }: PropsWithChildren): JSX.Element => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);
  const userId = useRef<string | null>(null);
  const profileRequest = useRef(0);

  const loadProfile = useCallback(async (expectedUserId: string) => {
    const request = ++profileRequest.current;
    let nextProfile: AuthProfile | null = null;
    let failed = false;
    try {
      const result = await authService.me();
      nextProfile = result.profile?.id === expectedUserId ? result.profile : null;
    } catch {
      failed = true;
    }
    if (request !== profileRequest.current || userId.current !== expectedUserId) return;
    setProfile(nextProfile);
    setProfileLoadFailed(failed);
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    let timer: number | undefined;
    let unsubscribe: (() => void) | undefined;
    const applySession = (nextSession: Session | null) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      const nextUserId = nextSession?.user.id ?? null;
      if (userId.current === nextUserId) {
        if (!nextUserId) setLoading(false);
        return;
      }
      userId.current = nextUserId;
      profileRequest.current += 1;
      setProfile(null);
      setProfileLoadFailed(false);
      setLoading(Boolean(nextUserId));
      window.clearTimeout(timer);
      // Load the profile after the SDK releases the auth event callback.
      if (nextUserId) timer = window.setTimeout(() => { void loadProfile(nextUserId); }, 0);
    };

    void emailLinkSessionReady.then(() => {
      if (!mounted) return;
      const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => applySession(nextSession));
      unsubscribe = () => data.subscription.unsubscribe();
    });

    return () => {
      mounted = false;
      window.clearTimeout(timer);
      userId.current = null;
      profileRequest.current += 1;
      unsubscribe?.();
    };
  }, [loadProfile]);

  const refreshAuth = useCallback(async () => {
    if (!userId.current) return;
    if (profileLoadFailed) setLoading(true);
    await loadProfile(userId.current);
  }, [loadProfile, profileLoadFailed]);

  const signOut = useCallback(async () => {
    await authService.logout();
    userId.current = null;
    profileRequest.current += 1;
    setSession(null);
    setUser(null);
    setProfile(null);
    setProfileLoadFailed(false);
    setLoading(false);
  }, []);

  const value = useMemo(() => ({ session, user, profile, loading, profileLoadFailed, refreshAuth, signOut }), [loading, profile, profileLoadFailed, refreshAuth, session, signOut, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
