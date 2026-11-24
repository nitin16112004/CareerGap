import { getEnv } from "./env";

export const aiRequest = (path: string, options: RequestInit = {}): Promise<Response> => {
  const { AI_SERVICE_URL, AI_SERVICE_TOKEN } = getEnv();
  const headers = new Headers(options.headers);
  if (AI_SERVICE_TOKEN) headers.set("Authorization", `Bearer ${AI_SERVICE_TOKEN}`);
  return fetch(`${AI_SERVICE_URL.replace(/\/$/, "")}${path}`, {
    ...options,
    headers,
    redirect: "error",
  });
};
