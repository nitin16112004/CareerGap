const { VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = process.env;

if (!/^https:\/\/[a-z0-9-]+\.onrender\.com\/api\/v1$/.test(VITE_API_URL ?? "")) {
  throw new Error("VITE_API_URL must be the HTTPS Render backend URL ending in /api/v1.");
}
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(VITE_SUPABASE_URL ?? "")) {
  throw new Error("VITE_SUPABASE_URL must be the HTTPS URL of the existing Cloud Supabase project.");
}

let publicKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(VITE_SUPABASE_ANON_KEY ?? "");
if (!publicKey) {
  try {
    const payload = JSON.parse(Buffer.from(VITE_SUPABASE_ANON_KEY.split(".")[1], "base64url").toString());
    const project = new URL(VITE_SUPABASE_URL).hostname.split(".")[0];
    publicKey = payload.role === "anon" && payload.ref === project;
  } catch {
    // The error below reports only the variable name.
  }
}
if (!publicKey) {
  throw new Error("VITE_SUPABASE_ANON_KEY must be the public publishable or matching legacy anon key.");
}
