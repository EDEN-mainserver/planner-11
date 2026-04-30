import { useEffect, useState } from "react";
import { USERS } from "../config/users";
import { saveSession, getSession } from "../utils/authSession";

function buildGoogleAuthUrl() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) return null;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${window.location.origin}/api/auth-google`,
    response_type: "code",
    scope: "email profile",
    access_type: "offline",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

function GoogleButton({ label }) {
  const googleUrl = buildGoogleAuthUrl();
  if (!googleUrl) return null;

  return (
    <a
      href={googleUrl}
      className="flex items-center justify-center gap-3 w-full py-3 border border-gray-200 rounded-2xl bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all"
    >
      <svg width="18" height="18" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      </svg>
      {label}
    </a>
  );
}

function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    setLoading(true);
    setError("");

    const user = USERS.find(
      (u) => u.username === username.trim() && u.password === password
    );

    if (!user) {
      setError("아이디 또는 비밀번호가 올바르지 않습니다");
      setLoading(false);
      return;
    }

    saveSession({
      id: user.id || user.username,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      provider: "local",
    });
    window.location.replace("/");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs font-bold text-gray-500 block mb-1.5">아이디</label>
        <input
          type="text"
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="아이디 입력"
          className="w-full px-4 py-3 text-sm border border-gray-200 rounded-2xl outline-none focus:border-violet-400 transition-colors bg-white"
        />
      </div>
      <div>
        <label className="text-xs font-bold text-gray-500 block mb-1.5">비밀번호</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호 입력"
          className="w-full px-4 py-3 text-sm border border-gray-200 rounded-2xl outline-none focus:border-violet-400 transition-colors bg-white"
        />
      </div>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !username.trim() || !password.trim()}
        className="w-full py-3 bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-2xl transition-all shadow-md"
      >
        {loading ? "로그인 중..." : "로그인"}
      </button>
    </form>
  );
}

export default function AuthPage({ mode = "login" }) {
  const isRegister = mode === "register";

  useEffect(() => {
    if (getSession()) {
      window.location.replace("/");
    }
  }, []);

  return (
    <div
      className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.18),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(236,72,153,0.14),_transparent_30%),linear-gradient(180deg,_#f8fafc_0%,_#f3f4f6_100%)] px-4 py-10"
      style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
    >
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[32px] border border-white/70 bg-white/75 shadow-[0_30px_90px_rgba(15,23,42,0.12)] backdrop-blur xl:grid-cols-[1.05fr_0.95fr]">
          <section className="relative hidden overflow-hidden bg-gradient-to-br from-slate-950 via-violet-900 to-fuchsia-700 p-10 text-white xl:block">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.24),transparent_24%),radial-gradient(circle_at_80%_30%,rgba(255,255,255,0.12),transparent_20%),radial-gradient(circle_at_40%_85%,rgba(255,255,255,0.1),transparent_22%)]" />
            <div className="relative flex h-full flex-col justify-between">
              <div>
                <p className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/80">
                  PlanForge UI
                </p>
                <h1 className="mt-6 text-4xl font-black leading-tight">
                  {isRegister ? "지금 바로 시작하고\nGoogle로 가입하세요" : "작업 공간으로 돌아와\n바로 이어서 작업하세요"}
                </h1>
                <p className="mt-5 max-w-md text-sm leading-6 text-white/72">
                  {isRegister
                    ? "현재 운영 가입 흐름은 Google OAuth 기준입니다. 가입 즉시 회원 DB에 등록되고, 역할은 관리자 화면에서 관리할 수 있습니다."
                    : "로컬 관리자 계정 또는 Google 계정으로 로그인할 수 있습니다. Google 로그인 사용자는 회원 DB와 권한 설정이 함께 동기화됩니다."}
                </p>
              </div>

              <div className="grid gap-3 text-sm text-white/80">
                <div className="rounded-2xl border border-white/12 bg-white/10 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">Access</p>
                  <p className="mt-2 font-semibold">Google OAuth, 관리자 역할 관리, 구독 상태 연동</p>
                </div>
                <div className="rounded-2xl border border-white/12 bg-white/10 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">Flow</p>
                  <p className="mt-2 font-semibold">
                    {isRegister ? "가입 후 자동 로그인 처리 → 홈으로 이동" : "로그인 완료 후 홈으로 이동"}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="p-6 sm:p-10">
            <div className="mx-auto max-w-md">
              <a href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors">
                <span className="text-base">←</span>
                홈으로 돌아가기
              </a>

              <div className="mt-8">
                <h2 className="text-3xl font-black tracking-tight text-gray-900">
                  {isRegister ? "회원가입" : "로그인"}
                </h2>
                <p className="mt-2 text-sm text-gray-500">
                  {isRegister
                    ? "Google 계정으로 가입한 뒤 바로 서비스를 사용할 수 있습니다."
                    : "계정에 로그인해서 대시보드와 자동화 기능을 이어서 사용하세요."}
                </p>
              </div>

              <div className="mt-8 space-y-6">
                {isRegister ? (
                  <>
                    <GoogleButton label="Google로 가입하기" />
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-4">
                      <p className="text-xs font-semibold text-gray-700">현재 가입 방식</p>
                      <p className="mt-1 text-sm leading-6 text-gray-500">
                        신규 가입은 Google OAuth만 사용합니다. 가입 후 자동으로 회원 DB에 저장되고 홈으로 이동합니다.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <LoginForm />
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-gray-200" />
                      <span className="text-xs text-gray-400">또는</span>
                      <div className="h-px flex-1 bg-gray-200" />
                    </div>
                    <GoogleButton label="Google로 계속하기" />
                  </>
                )}
              </div>

              <div className="mt-8 flex items-center justify-center gap-2 text-sm text-gray-500">
                <span>{isRegister ? "이미 계정이 있나요?" : "아직 계정이 없나요?"}</span>
                <a
                  href={isRegister ? "/login" : "/register"}
                  className="font-semibold text-violet-600 hover:text-violet-700"
                >
                  {isRegister ? "로그인" : "회원가입"}
                </a>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
