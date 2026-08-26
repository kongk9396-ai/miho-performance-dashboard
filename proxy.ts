import {
  NextRequest,
  NextResponse,
} from "next/server";

const ADMIN_COOKIE_NAME =
  "miho_admin_session";

export function proxy(
  request: NextRequest
) {
  const { pathname } =
    request.nextUrl;

  if (
    pathname.startsWith(
      "/api/admin/"
    )
  ) {
    const token =
      request.cookies.get(
        ADMIN_COOKIE_NAME
      )?.value;

    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "관리자 로그인이 필요합니다.",
        },
        {
          status: 401,
        }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/admin/:path*",
  ],
};