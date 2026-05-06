// Threads OAuth 콜백 핸들러
// Meta 앱에서 사용자 승인 후 redirect_uri로 code가 도착 → 토큰 교환 → 화면 표시
//
// 환경변수 (Vercel에 설정):
//   THREADS_APP_ID     — Meta 앱 ID
//   THREADS_APP_SECRET — Meta 앱 시크릿
//
// 사용 흐름:
//   1. Authorization URL 브라우저에서 열기
//      https://threads.net/oauth/authorize?client_id={APP_ID}&redirect_uri=https://planforge-eden-planner.vercel.app/auth/&scope=threads_basic,threads_content_publish&response_type=code
//   2. Threads 로그인/승인 → 이 핸들러로 ?code=XXX 도착
//   3. code → 단기 토큰 → 장기 토큰 자동 교환
//   4. 화면에 장기 토큰 표시 → 에덴 대시보드 Threads 탭에 붙여넣기

const TH_OAUTH = "https://graph.threads.net/oauth/access_token";
const TH_LONG  = "https://graph.threads.net/access_token";

export default async function handler(req, res) {
  const { code, error, error_description } = req.query;

  // Meta가 에러 반환한 경우
  if (error) {
    return res.status(400).send(page("인증 거부됨", `
      <div class="icon err">✕</div>
      <h2>인증이 거부되었습니다</h2>
      <p class="sub">${error_description || error}</p>
      <a href="javascript:history.back()" class="btn">돌아가기</a>
    `));
  }

  // code 없이 직접 접근한 경우 — 사용 안내 표시
  if (!code) {
    const appId     = process.env.THREADS_APP_ID     || "(THREADS_APP_ID 미설정)";
    const redirectUri = "https://planforge-eden-planner.vercel.app/auth/";
    const authUrl = `https://threads.net/oauth/authorize?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=threads_basic,threads_content_publish&response_type=code`;

    return res.status(200).send(page("Threads 인증", `
      <div class="icon">🔗</div>
      <h2>Threads 계정 연결</h2>
      <p class="sub">아래 버튼을 눌러 Threads 계정 접근을 승인하세요.</p>
      ${appId.includes("미설정") ? `
        <div class="warn">
          ⚠️ THREADS_APP_ID 환경변수가 설정되지 않았습니다.<br>
          Vercel 프로젝트 설정 → Environment Variables에 추가해주세요.
        </div>
      ` : `
        <a href="${authUrl}" class="btn">Threads 계정 연결하기</a>
      `}
      <div class="info">
        <b>필요한 환경변수</b><br>
        THREADS_APP_ID = Meta 앱 ID<br>
        THREADS_APP_SECRET = Meta 앱 시크릿
      </div>
    `));
  }

  // code → 토큰 교환
  const appId     = process.env.THREADS_APP_ID;
  const appSecret = process.env.THREADS_APP_SECRET;

  if (!appId || !appSecret) {
    // 환경변수 없으면 code만 표시 (수동 교환 안내)
    return res.status(200).send(page("인증 코드 수신", `
      <div class="icon ok">✓</div>
      <h2>인증 코드 수신 완료</h2>
      <p class="sub">아래 코드로 액세스 토큰을 교환하세요.</p>
      <div class="warn">⚠️ THREADS_APP_ID / THREADS_APP_SECRET 환경변수가 없어 자동 교환 불가</div>
      <label>Authorization Code</label>
      <div class="token-box">${code}</div>
      <button onclick="navigator.clipboard.writeText('${code}');this.textContent='복사됨!'" class="btn copy">코드 복사</button>
      <div class="info">
        <b>터미널에서 토큰 교환:</b><br>
        <pre>curl -X POST https://graph.threads.net/oauth/access_token \\
  -F client_id={APP_ID} \\
  -F client_secret={APP_SECRET} \\
  -F grant_type=authorization_code \\
  -F redirect_uri=https://planforge-eden-planner.vercel.app/auth/ \\
  -F code=${code}</pre>
      </div>
    `));
  }

  try {
    // 1단계: code → 단기 토큰
    const shortParams = new URLSearchParams({
      client_id:     appId,
      client_secret: appSecret,
      grant_type:    "authorization_code",
      redirect_uri:  "https://planforge-eden-planner.vercel.app/auth/",
      code,
    });
    const shortRes  = await fetch(TH_OAUTH, { method: "POST", body: shortParams });
    const shortData = await shortRes.json();

    if (!shortRes.ok || !shortData.access_token) {
      throw new Error(shortData.error_message || shortData.error?.message || `단기 토큰 교환 실패 (${shortRes.status})`);
    }

    const shortToken = shortData.access_token;

    // 2단계: 단기 → 장기 토큰 (60일)
    const longRes  = await fetch(
      `${TH_LONG}?grant_type=th_exchange_token&client_secret=${encodeURIComponent(appSecret)}&access_token=${encodeURIComponent(shortToken)}`
    );
    const longData = await longRes.json();

    if (!longRes.ok || !longData.access_token) {
      throw new Error(longData.error?.message || `장기 토큰 교환 실패 (${longRes.status})`);
    }

    const longToken  = longData.access_token;
    const expiresIn  = longData.expires_in; // 초 단위
    const expiresDays = expiresIn ? Math.round(expiresIn / 86400) : 60;

    // 3단계: userId 조회
    let userId = "", username = "";
    try {
      const meRes  = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${longToken}`);
      const meData = await meRes.json();
      userId   = meData.id       || "";
      username = meData.username || "";
    } catch {}

    return res.status(200).send(page("연결 완료!", `
      <div class="icon ok">✓</div>
      <h2>Threads 연결 완료!</h2>
      ${username ? `<p class="sub">@${username}${userId ? ` (ID: ${userId})` : ""}</p>` : ""}
      <p class="sub">장기 토큰 (${expiresDays}일 유효)</p>

      <label>Access Token</label>
      <div class="token-box" id="token">${longToken}</div>
      <button onclick="navigator.clipboard.writeText(document.getElementById('token').textContent);this.textContent='복사됨!';setTimeout(()=>this.textContent='토큰 복사',2000)" class="btn copy">
        토큰 복사
      </button>

      ${userId ? `
        <label style="margin-top:16px">User ID</label>
        <div class="token-box" id="uid">${userId}</div>
        <button onclick="navigator.clipboard.writeText('${userId}');this.textContent='복사됨!';setTimeout(()=>this.textContent='ID 복사',2000)" class="btn copy" style="background:#374151">
          ID 복사
        </button>
      ` : ""}

      <div class="info" style="margin-top:20px">
        <b>다음 단계</b><br>
        에덴 대시보드 → 이미지 콘텐츠 → Threads 탭<br>
        → 액세스 토큰 붙여넣기 → 설정 저장
      </div>
    `));

  } catch (err) {
    return res.status(500).send(page("오류 발생", `
      <div class="icon err">✕</div>
      <h2>토큰 교환 실패</h2>
      <p class="sub">${err.message}</p>
      <div class="info">code 값이 만료되었을 수 있습니다. (code는 1회용, 5분 유효)<br>다시 인증을 시도해주세요.</div>
      <a href="/auth/" class="btn">다시 시도</a>
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
<title>${title} — Threads 연동</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
    background: #f9fafb;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .card {
    background: white;
    border-radius: 20px;
    border: 1px solid #e5e7eb;
    padding: 40px 36px;
    max-width: 520px;
    width: 100%;
    text-align: center;
    box-shadow: 0 4px 24px rgba(0,0,0,.06);
  }
  .icon {
    font-size: 40px;
    margin-bottom: 16px;
  }
  .icon.ok  { color: #10b981; }
  .icon.err { color: #ef4444; }
  h2 { font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 8px; }
  .sub { font-size: 14px; color: #6b7280; margin-bottom: 20px; }
  label { display: block; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 6px; }
  .token-box {
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 12px 14px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    word-break: break-all;
    color: #1f2937;
    text-align: left;
    margin-bottom: 10px;
  }
  .btn {
    display: inline-block;
    background: #111827;
    color: white;
    border: none;
    border-radius: 10px;
    padding: 12px 28px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    margin-bottom: 16px;
    transition: background .15s;
  }
  .btn:hover { background: #1f2937; }
  .btn.copy { background: #7c3aed; width: 100%; }
  .btn.copy:hover { background: #6d28d9; }
  .info {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 14px 16px;
    font-size: 12px;
    color: #475569;
    text-align: left;
    line-height: 1.7;
  }
  .info pre {
    margin-top: 8px;
    background: #1e293b;
    color: #94a3b8;
    padding: 10px 12px;
    border-radius: 8px;
    font-size: 11px;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .warn {
    background: #fff7ed;
    border: 1px solid #fed7aa;
    border-radius: 10px;
    padding: 12px 16px;
    font-size: 12px;
    color: #92400e;
    margin-bottom: 16px;
    text-align: left;
    line-height: 1.6;
  }
</style>
</head>
<body>
<div class="card">
  ${body}
</div>
</body>
</html>`;
}
