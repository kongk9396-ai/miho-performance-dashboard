import crypto from "crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME =
  "miho_admin_session";

function getSecret() {
  const secret =
    process.env.ADMIN_SESSION_SECRET;

  if (!secret) {
    throw new Error(
      "ADMIN_SESSION_SECRET is not configured."
    );
  }

  return secret;
}

export function verifyAdminCredentials(
  username: string,
  password: string
) {
  const expectedUsername =
    process.env.ADMIN_USERNAME;

  const expectedPassword =
    process.env.ADMIN_PASSWORD;

  if (
    !expectedUsername ||
    !expectedPassword
  ) {
    return false;
  }

  return (
    username === expectedUsername &&
    password === expectedPassword
  );
}

export function createAdminSession() {
  const payload = {
    role: "admin",
    exp:
      Date.now() +
      1000 * 60 * 60 * 12,
  };

  const encoded =
    Buffer.from(
      JSON.stringify(payload)
    ).toString("base64url");

  const signature =
    crypto
      .createHmac(
        "sha256",
        getSecret()
      )
      .update(encoded)
      .digest("base64url");

  return `${encoded}.${signature}`;
}

export function verifyAdminSession(
  token?: string
) {
  if (!token) {
    return false;
  }

  try {
    const [
      encoded,
      signature,
    ] = token.split(".");

    if (
      !encoded ||
      !signature
    ) {
      return false;
    }

    const expected =
      crypto
        .createHmac(
          "sha256",
          getSecret()
        )
        .update(encoded)
        .digest("base64url");

    const signatureBuffer =
      Buffer.from(signature);

    const expectedBuffer =
      Buffer.from(expected);

    if (
      signatureBuffer.length !==
      expectedBuffer.length
    ) {
      return false;
    }

    if (
      !crypto.timingSafeEqual(
        signatureBuffer,
        expectedBuffer
      )
    ) {
      return false;
    }

    const payload =
      JSON.parse(
        Buffer.from(
          encoded,
          "base64url"
        ).toString("utf8")
      ) as {
        role?: string;
        exp?: number;
      };

    return (
      payload.role === "admin" &&
      typeof payload.exp ===
        "number" &&
      payload.exp > Date.now()
    );
  } catch {
    return false;
  }
}

export async function isAdminAuthenticated() {
  const cookieStore =
    await cookies();

  const token =
    cookieStore.get(
      ADMIN_COOKIE_NAME
    )?.value;

  return verifyAdminSession(
    token
  );
}