import { describe, expect, it } from "vitest";

import { verifyEmailSchema } from "./auth.validators";

describe("verifyEmailSchema", () => {
  const parseCode = (token: string) => verifyEmailSchema.safeParse({
    body: { email: "test@example.com", token },
  });

  it.each(["012345", "01234567", "0123456789"])("accepts a supported code length for %s", (token) => {
    expect(parseCode(` ${token} `)).toMatchObject({ success: true, data: { body: { token } } });
  });

  it.each(["12345", "01234567890", "1234ab78", "1234 5678"])("rejects the invalid code %s", (token) => {
    expect(parseCode(token).success).toBe(false);
  });
});
