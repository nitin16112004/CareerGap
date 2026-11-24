import { createHash, randomUUID } from "node:crypto";
import type { Env } from "../config/env";
import { HttpError } from "../utils/http-error";
import type { TransactionalEmailRequest, TransactionalEmailResult } from "./email.service";

const oauthUrl = "https://oauth2.googleapis.com/token";
const sendUrl = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const mailAddress = /^[^\s<>@,;:]+@[^\s<>@,;:]+\.[^\s<>@,;:]+$/;
const encode = (value: string): string => Buffer.from(value).toString("base64");
const encodeBody = (value: string): string => encode(value).match(/.{1,76}/g)?.join("\r\n") ?? "";

let accessToken: { value: string; expiresAt: number } | undefined;

const getAccessToken = async (env: Env): Promise<string> => {
  if (accessToken && accessToken.expiresAt > Date.now() + 60_000) return accessToken.value;
  const response = await fetch(oauthUrl, {
    method: "POST",
    body: new URLSearchParams({
      client_id: env.GMAIL_CLIENT_ID,
      client_secret: env.GMAIL_CLIENT_SECRET,
      refresh_token: env.GMAIL_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  const token = await response.json().catch(() => null) as { access_token?: string; expires_in?: number } | null;
  if (!response.ok || !token?.access_token) {
    throw new HttpError(502, "Gmail authorization failed. Check the sender's OAuth grant.", "GMAIL_AUTH_FAILED", false);
  }
  accessToken = { value: token.access_token, expiresAt: Date.now() + (token.expires_in ?? 0) * 1_000 };
  return accessToken.value;
};

export const sendGmail = async (env: Env, input: TransactionalEmailRequest): Promise<TransactionalEmailResult> => {
  const sender = env.GMAIL_SENDER.trim();
  if (!mailAddress.test(sender) || !env.GMAIL_CLIENT_ID.trim() ||
      !env.GMAIL_CLIENT_SECRET.trim() || !env.GMAIL_REFRESH_TOKEN.trim()) {
    throw new HttpError(503, "Gmail reminder credentials are incomplete.", "EMAIL_PROVIDER_NOT_CONFIGURED", false);
  }
  if (!mailAddress.test(input.to)) {
    throw new HttpError(400, "The reminder recipient address is invalid.", "EMAIL_RECIPIENT_INVALID", false);
  }

  const boundary = randomUUID();
  const messageId = createHash("sha256").update(input.idempotencyKey || boundary).digest("hex");
  const subject = input.subject.replace(/[\r\n]/g, " ");
  const raw = [
    `From: CareerGuid AI <${sender}>`,
    `To: ${input.to}`,
    `Subject: =?UTF-8?B?${encode(subject)}?=`,
    `Message-ID: <${messageId}@${sender.split("@")[1]}>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    encodeBody(input.text),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    encodeBody(input.html),
    `--${boundary}--`,
    "",
  ].join("\r\n");
  try {
    const token = await getAccessToken(env);
    const response = await fetch(sendUrl, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ raw: Buffer.from(raw).toString("base64url") }),
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    if (response.status === 401) accessToken = undefined;
    const body = await response.json().catch(() => null) as { id?: string } | null;
    if (!response.ok || !body?.id) {
      throw new HttpError(502, "Gmail did not accept the reminder email.", "EMAIL_PROVIDER_FAILED", false);
    }
    return { provider: "gmail", providerMessageId: body.id };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new HttpError(504, "Gmail delivery timed out.", "EMAIL_PROVIDER_TIMEOUT", false);
    }
    throw new HttpError(502, "Gmail delivery failed.", "EMAIL_PROVIDER_FAILED", false);
  }
};
