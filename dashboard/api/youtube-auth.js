// YouTube OAuth 2.0 콜백 핸들러
// Google Cloud Console → OAuth 2.0 클라이언트 ID → 리디렉션 URI:
//   https://planforge-eden-planner.vercel.app/api/youtube-auth
//
// 환경변수 (Vercel에 설정):
//   YOUTUBE_CLIENT_ID     — Google OAuth 클라이언트 ID
//   YOUTUBE_CLIENT_SECRET — Google OAuth 클라이언트 시크릿
//
// 사용 흐름:
//   1. 대시보드 → YouTube 연동 버튼 클릭 → 팝업 창으로 아래 URL 열기
//      https://accounts.google.com/o/oauth2/v2/auth?...
//   2. Google 로그인 → 채널 접근 승인
//   3. 이 핸들러로 ?code=XXX 도착 → 토큰 교환 → postMessage로 부모 창에 전달
//   4. 팝업 창 자동 닫힘

const REDIRECT_URI = "https://planforge-eden-planner.vercel.app/api/youtube-auth";
const TOKEN_URL    = "https://oauth2.googleapis.com/token";
const SCOPE        = "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly";

export default async function handler(req, res) {
  const { code, error } = req.query;

  const clientId     = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

  // 에러 반환
  if (error) {
    return res.status(400).send(page("인증 거부됨", `
      <div class="icon err">✕</div>
      <h2>인증이 거부되었습니다</h2>
      <p class="sub">${error}</p>
      <button onclick="window.close()" class="btn">닫기</button>
    `));
  }

  // code 없이 접근 — OAuth URL로 리디렉트
  if (!code) {
    if (!clientId) {
      return res.status(200).send(page("YouTube 연동", `
        <div class="icon err">⚠</div>
        <h2>환경변수 미설정</h2>
        <div class="warn">
          YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET 환경변수가 없습니다.<br>
          Vercel 프로젝트 설정 → Environment Variables에 추가해주세요.
        </div>
        <button onclick="window.close()" class="btn">닫기</button>
      `));
    }

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id",     clientId);
    authUrl.searchParams.set("redirect_uri",  REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope",         SCOPE);
    authUrl.searchParams.set("access_type",   "offline");
    authUrl.searchParams.set("prompt",        "consent"); // refresh_token 항상 발급

    return res.redirect(authUrl.toString());
  }

  // code → 토큰 교환
  if (!clientId || !clientSecret) {
    return res.status(500).send(page("오류", `
      <div class="icon err">✕</div>
      <h2>환경변수 없음</h2>
      <p class="sub">YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET이 설정되지 않았습니다.</p>
      <button onclick="window.close()" class="btn">닫기</button>
    `));
  }

  try {
    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  REDIRECT_URI,
        grant_type:    "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokenRes.ok || !tokens.access_token) {
      throw new Error(tokens.error_description || tokens.error || `토큰 교환 실패 (${tokenRes.status})`);
    }

    // 채널 정보 조회
    let channelTitle = "";
    try {
      const chRes = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&access_token=${tokens.access_token}`
      );
      const chData = await chRes.json();
      channelTitle = chData.items?.[0]?.snippet?.title || "";
    } catch (_) {}

    // postMessage로 부모 창(대시보드)에 토큰 전달 후 팝업 닫기
    return res.status(200).send(page("연결 완료!", `
      <div class="icon ok">✓</div>
      <h2>YouTube 채널 연결 완료!</h2>
      ${channelTitle ? `<p class="sub">채널: ${channelTitle}</p>` : ""}
      <p class="sub" style="margin-top:8px;color:#6b7280">창이 자동으로 닫힙니다...</p>
      <script>
        try {
          window.opener.postMessage({
            type:         "youtube-auth",
            accessToken:  ${JSON.stringify(tokens.access_token)},
            refreshToken: ${JSON.stringify(tokens.refresh_token ?? "")},
            expiresIn:    ${tokens.expires_in ?? 3600},
            channelTitle: ${JSON.stringify(channelTitle)},
          }, "*");
        } catch(e) {}
        setTimeout(() => window.close(), 1500);
      </script>
    `));

  } catch (err) {
    return res.status(500).send(page("오류 발생", `
      <div class="icon err">✕</div>
      <h2>토큰 교환 실패</h2>
      <p class="sub">${err.message}</p>
      <button onclick="window.close()" class="btn">닫기</button>
    `));
  }
}

// ── HTML 페이지 템플릿 ──
function page(title, body) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — YouTube 연동</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
    background: #f9fafb; min-height: 100vh;
    display: flex; align-items: center; justify-content: center; padding: 24px;
  }
  .card {
    background: white; border-radius: 20px; border: 1px solid #e5e7eb;
    padding: 40px 36px; max-width: 480px; width: 100%;
    text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,.06);
  }
  .icon { font-size: 40px; margin-bottom: 16px; }
  .icon.ok  { color: #10b981; }
  .icon.err { color: #ef4444; }
  h2 { font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 8px; }
  .sub { font-size: 14px; color: #6b7280; margin-bottom: 20px; }
  .btn {
    display: inline-block; background: #111827; color: white; border: none;
    border-radius: 10px; padding: 12px 28px; font-size: 14px; font-weight: 600;
    cursor: pointer; text-decoration: none; margin-bottom: 16px;
  }
  .warn {
    background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px;
    padding: 12px 16px; font-size: 12px; color: #92400e;
    margin-bottom: 16px; text-align: left; line-height: 1.6;
  }
</style>
</head>
<body>
<div class="card">${body}</div>
</body>
</html>`;
}
