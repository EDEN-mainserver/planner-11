// Google OAuth 2.0 콜백 핸들러
// 흐름: Google 로그인 → /api/auth-google?code=... 콜백
//       → code 교환 → 사용자 정보 조회 → Blob DB 저장
//       → 세션 주입 HTML → 클라이언트 localStorage 저장 → 홈 리다이렉트

import { put, list } from "@vercel/blob";

const GOOGLE_TOKEN_URL   = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const USERS_BLOB_PATH    = "auth/google-users.json";
const SESSION_KEY        = "eden_auth_v1";

// ── Blob: 사용자 목록 읽기 ──
async function readUsers() {
  try {
    const { blobs } = await list({ prefix: USERS_BLOB_PATH });
    if (!blobs.length) return [];
    const res = await fetch(blobs[0].url, { cache: "no-store" });
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

// ── Blob: 사용자 목록 저장 ──
async function writeUsers(users) {
  await put(USERS_BLOB_PATH, JSON.stringify(users, null, 2), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
  });
}

// ── redirect_uri 결정 (등록된 Google Console URI와 일치해야 함) ──
function getRedirectUri(req) {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  const host = req.headers["x-forwarded-host"] || req.headers.host || "";
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${host}/api/auth-google`;
}

export default async function handler(req, res) {
  const { code, error, error_description } = req.query;

  if (error) {
    return res.status(400).send(htmlPage("인증 거부됨", `
      <p style="color:#ef4444">${error_description || error}</p>
      <a href="/">홈으로 돌아가기</a>
    `));
  }

  if (!code) {
    return res.status(400).send(htmlPage("잘못된 요청", `
      <p>code 파라미터가 없습니다.</p>
      <a href="/">홈으로 돌아가기</a>
    `));
  }

  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).send(htmlPage("설정 오류", `
      <p>GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET 환경변수를 Vercel에 설정해주세요.</p>
    `));
  }

  try {
    const redirectUri = getRedirectUri(req);

    // 1. code → access_token 교환
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  redirectUri,
        grant_type:    "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      throw new Error(tokenData.error_description || "Google 토큰 교환 실패");
    }

    // 2. 사용자 정보 조회
    const userRes  = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const gUser = await userRes.json();
    if (!gUser.email) throw new Error("Google 이메일 정보를 가져올 수 없습니다");

    // 3. DB 업서트
    const users   = await readUsers();
    const userId  = `google_${gUser.id}`;
    const existing = users.find(u => u.id === userId);

    const record = {
      id:          userId,
      email:       gUser.email,
      displayName: gUser.name || gUser.email.split("@")[0],
      picture:     gUser.picture || null,
      provider:    "google",
      role:        existing?.role || "user",
      createdAt:   existing?.createdAt || new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    if (existing) {
      users[users.findIndex(u => u.id === userId)] = record;
    } else {
      users.push(record);
    }
    await writeUsers(users);

    // 4. 세션 주입 HTML 반환 → localStorage 설정 후 홈 리다이렉트
    const session = {
      username:    userId,
      displayName: record.displayName,
      email:       record.email,
      picture:     record.picture,
      provider:    "google",
    };

    const sessionJson  = JSON.stringify(session);
    const sessionJsonE = JSON.stringify(sessionJson); // 이중 직렬화 (문자열 안전 삽입)

    return res.status(200).send(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>로그인 중...</title>
  <style>
    body { font-family: sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; background:#f9fafb; }
    .box { text-align:center; }
    .spinner { width:36px; height:36px; border:3px solid #e5e7eb; border-top-color:#7c3aed; border-radius:50%; animation:spin .8s linear infinite; margin:0 auto 12px; }
    @keyframes spin { to { transform:rotate(360deg); } }
    p { color:#6b7280; font-size:14px; }
  </style>
</head>
<body>
<div class="box">
  <div class="spinner"></div>
  <p>Google 로그인 완료, 이동 중...</p>
</div>
<script>
  (function() {
    try {
      localStorage.setItem(${JSON.stringify(SESSION_KEY)}, ${sessionJsonE});
      window.dispatchEvent(new CustomEvent("eden-session-change", { detail: ${sessionJson} }));
    } catch(e) {}
    window.location.replace("/");
  })();
</script>
</body>
</html>`);

  } catch (err) {
    console.error("[auth-google]", err);
    return res.status(500).send(htmlPage("로그인 오류", `
      <p style="color:#ef4444">${err.message}</p>
      <a href="/">다시 시도하기</a>
    `));
  }
}

function htmlPage(title, body) {
  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><title>${title}</title>
<style>body{font-family:sans-serif;text-align:center;padding:60px;background:#f9fafb;}a{color:#7c3aed;}</style>
</head><body><h2>${title}</h2>${body}</body></html>`;
}
