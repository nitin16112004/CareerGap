export const publicSupabaseStorageUrl = (signedUrl: string): string => {
  const origin = process.env.SUPABASE_PUBLIC_URL;
  if (!origin) return signedUrl;

  const signed = new URL(signedUrl);
  const browserUrl = new URL(origin);
  browserUrl.pathname = signed.pathname;
  browserUrl.search = signed.search;
  return browserUrl.href;
};
