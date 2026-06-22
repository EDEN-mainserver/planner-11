export { auth as middleware } from "@/lib/auth";

export const config = {
  // 보호할 라우트 패턴 (로그인 필요)
  matcher: ["/dashboard/:path*", "/editor/:path*", "/my-project/:path*"],
};
