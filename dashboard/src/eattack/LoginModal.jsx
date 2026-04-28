// 로그인 모달
// src/config/users.js 에서 계정 관리
import { useState } from "react";
import { USERS } from "../config/users";

// Google OAuth URL 생성
function buildGoogleAuthUrl() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) return null;
  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  `${window.location.origin}/api/auth-google`,
    response_type: "code",
    scope:         "email profile",
    access_type:   "offline",
    prompt:        "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

const SESSION_KEY = "eden_auth_v1";

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export default function LoginModal({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const googleUrl = buildGoogleAuthUrl();

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

    const session = { username: user.username, displayName: user.displayName };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    window.dispatchEvent(new CustomEvent("eden-session-change", { detail: session }));
    onLogin(session);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-violet-600 to-pink-500 px-6 py-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-3 shadow">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="7" height="7" x="3" y="3" rx="1"/>
              <rect width="7" height="7" x="14" y="3" rx="1"/>
              <rect width="7" height="7" x="14" y="14" rx="1"/>
              <rect width="7" height="7" x="3" y="14" rx="1"/>
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white">카드뉴스 파이프라인</h2>
          <p className="text-sm text-white/70 mt-1">로그인 후 이용할 수 있습니다</p>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1.5">아이디</label>
            <input
              type="text"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="아이디 입력"
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-violet-400 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1.5">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 입력"
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-violet-400 transition-colors"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password.trim()}
            className="w-full py-3 bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all shadow-md mt-2"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>

          {googleUrl && (
            <>
              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">또는</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <a
                href={googleUrl}
                className="flex items-center justify-center gap-3 w-full py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all text-sm font-semibold text-gray-700"
              >
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Google로 계속하기
              </a>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
