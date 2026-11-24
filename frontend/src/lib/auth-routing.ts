import type { AuthProfile } from "../types/auth";

export const safeRedirect = (path: string | null | undefined): string | null =>
  path?.startsWith("/") && !path.startsWith("//") && !/[\\\u0000-\u001f\u007f]/.test(path) ? path : null;

export const afterSignIn = (profile: AuthProfile | null | undefined, redirect?: string | null): string =>
  safeRedirect(redirect) ?? (profile?.role === "admin" ? "/admin" : profile?.onboarding_completed ? "/dashboard" : "/onboarding/upload-resume");
