import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL || "https://example.supabase.co";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "public-anon-key-placeholder";

export const supabase = createClient(url, anonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    flowType: "pkce",
    detectSessionInUrl: false,
  },
});

const restoreEmailLinkSession = async (): Promise<void> => {
  if (typeof window === "undefined") return;
  const { pathname, search, hash } = window.location;
  if (pathname !== "/verify-email" && pathname !== "/reset-password") return;
  // The existing server-generated email links still carry an implicit grant.
  const fragment = new URLSearchParams(hash.slice(1));
  const accessToken = fragment.get("access_token");
  const refreshToken = fragment.get("refresh_token");
  if (!accessToken || !refreshToken) return;
  window.history.replaceState(window.history.state, "", pathname + search);
  await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
};

export const emailLinkSessionReady = restoreEmailLinkSession().catch(() => undefined);

export const hasSupabaseConfiguration = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
);
