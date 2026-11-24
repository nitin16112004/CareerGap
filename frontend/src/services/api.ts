import { supabase } from "../lib/supabase";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1").replace(/\/$/, "");
const renderApi = /^https:\/\/[a-z0-9-]+\.onrender\.com\/api\/v1$/.test(API_URL);
const listeners = new Set<() => void>();
let warmup: Promise<void> | undefined;
let lastResponseAt = 0;

export const subscribeToApiStartup = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export const apiIsStarting = (): boolean => warmup !== undefined;

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const waitForRender = async (): Promise<void> => {
  if (!renderApi || Date.now() - lastResponseAt < 10 * 60_000) return;
  if (!warmup) {
    const checkService = async (): Promise<void> => {
      const deadline = Date.now() + 85_000;
      while (Date.now() < deadline) {
        try {
          const response = await fetch(`${API_URL.slice(0, -3)}/health/live`, {
            cache: "no-store",
            signal: AbortSignal.timeout(Math.min(8_000, Math.max(1, deadline - Date.now()))),
          });
          if (response.ok && (await response.json()).status === "ok") {
            lastResponseAt = Date.now();
            return;
          }
        } catch {
          // Render can return a loading page while it starts the service.
        }
        await new Promise((resolve) => setTimeout(resolve, 2_000));
      }
      throw new ApiError("The server is still starting. Please try again shortly.", 503, "API_WAKING");
    };
    warmup = checkService().finally(() => {
      warmup = undefined;
      listeners.forEach((listener) => listener());
    });
    listeners.forEach((listener) => listener());
  }
  await warmup;
};

export const apiRequest = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  await waitForRender();
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (data.session?.access_token) headers.set("Authorization", `Bearer ${data.session.access_token}`);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    lastResponseAt = 0;
    throw new ApiError("Unable to reach the server. Please try again.", 0, "NETWORK_ERROR");
  }

  if (response.status === 204) return undefined as T;

  const body = await response.json().catch(() => null) as { success?: boolean; message?: string; errorCode?: string; data?: T } | null;
  if (renderApi && !body && response.status >= 500) lastResponseAt = 0;
  if (body) lastResponseAt = Date.now();
  if (!response.ok || body?.success === false) {
    throw new ApiError(body?.message || "Something went wrong. Please try again.", response.status, body?.errorCode);
  }
  if (!body || typeof body !== "object") {
    throw new ApiError("The app received an unexpected response. Please try again.", response.status, "INVALID_API_RESPONSE");
  }
  return body.data !== undefined ? body.data : body as T;
};
