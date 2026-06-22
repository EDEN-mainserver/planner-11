import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const OUTREACH_OWNER = (
  process.env.OUTREACH_OWNER_EMAIL || "EDEN@teamedenmarketing.com"
).toLowerCase();

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const email = session?.user?.email?.toLowerCase();

  // 로그인 필요 경로
  const requiresLogin =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/editor") ||
    pathname.startsWith("/my-project") ||
    pathname.startsWith("/outreach");

  if (requiresLogin && !session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // /outreach/* 는 정대표 전용
  if (pathname.startsWith("/outreach") && email !== OUTREACH_OWNER) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/editor/:path*",
    "/my-project/:path*",
    "/outreach/:path*",
  ],
};
