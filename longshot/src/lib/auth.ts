import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      // /outreach/* 는 단일 사용자 전용 (정대표)
      const allowed = (process.env.OUTREACH_OWNER_EMAIL || "EDEN@teamedenmarketing.com").toLowerCase();
      const email = (user.email || "").toLowerCase();
      // 다른 페이지(/dashboard 등)는 누구나 로그인 가능. /outreach 차단은 middleware에서 한 번 더.
      // 여기서는 화이트리스트 이메일에만 별도 권한 플래그 부여 시 사용 가능.
      // signIn 자체는 모두 허용하고, /outreach 접근은 미들웨어가 처리.
      if (email === allowed) return true;
      return true;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
  },
  session: {
    strategy: "jwt",
  },
});
