import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  ADMIN_COOKIE_NAME,
  createAdminSession,
  verifyAdminCredentials,
} from "@/lib/auth/admin";

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      await request.json();

    const username =
      String(
        body.username ?? ""
      ).trim();

    const password =
      String(
        body.password ?? ""
      );

    if (
      !verifyAdminCredentials(
        username,
        password
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "아이디 또는 비밀번호가 올바르지 않습니다.",
        },
        {
          status: 401,
        }
      );
    }

    const response =
      NextResponse.json({
        ok: true,
      });

    response.cookies.set(
      ADMIN_COOKIE_NAME,
      createAdminSession(),
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "lax",
        path: "/",
        maxAge:
          60 * 60 * 12,
      }
    );

    return response;
  } catch (error) {
    console.error(
      "Login error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "로그인 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}