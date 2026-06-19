import { cookies } from "next/headers";
import crypto from "crypto";

const CSRF_COOKIE_NAME = "csrf-token";
const CSRF_HEADER_NAME = "x-csrf-token";

export async function generateCSRFToken(): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });
  return token;
}

export async function verifyCSRFToken(token: string): Promise<boolean> {
  const cookieStore = await cookies();
  const storedToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;

  if (!storedToken || !token) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(storedToken),
    Buffer.from(token)
  );
}

export async function getCSRFToken(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(CSRF_COOKIE_NAME)?.value;

  if (existing) {
    return existing;
  }

  return generateCSRFToken();
}
