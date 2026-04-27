// Instagram OAuth 콜백 핸들러
// Meta 앱에서 사용자 승인 후 redirect_uri로 code가 도착 → 토큰 교환 → IG 계정 ID 조회 → 화면 표시
//
// 환경변수 (Vercel에 설정):
//   IG_APP_ID     — Meta 앱 ID
//   IG_APP_SECRET — Meta 앱 시크릿
//
// 사용 흐름:
//   1. https://planforge-eden-planner.vercel.app/auth/instagram/ 접속
//   2. "Instagram 계정 연결하기" 클릭 → Meta 로그인/승인
//   3. 이 핸들러로 ?code=XXX 도착 → 장기 토큰 + IG 계정 ID 자동 조회
//   4. 에덴 대시보드 → 통합 파이프라인 → Instagram 설정에 붙여넣기

const FB_API       = "https://graph.facebook.com/v21.0";
const FB_TOKEN_URL = `${FB_API}/oauth/access_token`;
const REDIRECT_URI = "https://planforge-eden-planner.vercel.app/auth/instagram/";

const SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_read_engagement",
  "pages_show_list",
].join(",");

export default async function handler(req, res) {
  const { code, error, error_description } = req.query;

  // Meta가 에러 반환한 경우
  if (error) {
    return res.status(400).send(page("인증 거부됨", `
      <div class="icon err">✕</div>
      <h2>인증이 거부되었습니다</h2>
      <p class="sub">${error_description || error}</p>
      <a href="/auth/instagram/" class="btn">다시 시도</a>
    `));
  }

  const appId     = process.env.IG_APP_ID;
  const appSecret = process.env.IG_APP_SECRET;

  // code 없이 직접 접근 — 인증 시작 화면
  if (!code) {
    if (!appId) {
      return res.status(200).send(page("Instagram 연동", `
        <div class="icon">📷</div>
        <h2>Instagram 계정 연결</h2>
        <div class="warn">
          ⚠️ IG_APP_ID 환경변수가 설정되지 않았습니다.<br>
          Vercel 프로젝트 설정 → Environment Variables에 추가해주세요.
        </div>
        <div class="info">
          <b>필요한 환경변수</b><br>
          IG_APP_ID = Meta 앱 ID<br>
          IG_APP_SECRET = Meta 앱 시크릿
        </div>
      `));
    }

    const authUrl =
      `https://www.facebook.com/dialog/oauth` +
      `?client_id=${appId}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&scope=${encodeURIComponent(SCOPES)}` +
      `&response_type=code`;

    return res.status(200).send(page("Instagram 연동", `
      <div class="icon">📷</div>
      <h2>Instagram 계정 연결</h2>
      <p class="sub">Instagram 비즈니스 계정 또는 크리에이터 계정이 필요합니다.</p>
      <a href="${authUrl}" class="btn">Instagram 계정 연결하기</a>
      <div class="info">
        <b>연결 후 자동으로 얻는 정보</b><br>
        • 장기 액세스 토큰 (60일)<br>
        • Instagram 비즈니스 계정 ID<br>
        • 계정 사용자명
      </div>
    `));
  }

  // 환경변수 없으면 code만 표시
  if (!appId || !appSecret) {
    return res.status(200).send(page("인증 코드 수신", `
      <div class="icon ok">✓</div>
      <h2>인증 코드 수신 완료</h2>
      <div class="warn">⚠️ IG_APP_ID / IG_APP_SECRET 환경변수가 없어 자동 교환 불가</div>
      <label>Authorization Code</label>
      <div class="token-box" id="code">${code}</div>
      <button onclick="navigator.clipboard.writeText('${code}');this.textContent='복사됨!';setTimeout(()=>this.textContent='코드 복사',2000)" class="btn copy">코드 복사</button>
    `));
  }

  try {
    // 1단계: code → 단기 토큰
    const shortRes = await fetch(
      `${FB_TOKEN_URL}?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&code=${encodeURIComponent(code)}`
    );
    const shortData = await shortRes.json();
    if (!shortRes.ok || !shortData.access_token) {
      throw new Error(shortData.error?.message || `단기 토큰 교환 실패 (${shortRes.status})`);
    }
    const shortToken = shortData.access_token;

    // 2단계: 단기 → 장기 토큰 (60일)
    const longRes = await fetch(
      `${FB_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${encodeURIComponent(shortToken)}`
    );
    const longData = await longRes.json();
    if (!longRes.ok || !longData.access_token) {
      throw new Error(longData.error?.message || `장기 토큰 교환 실패 (${longRes.status})`);
    }
    const longToken  = longData.access_token;
    const expiresDays = longData.expires_in ? Math.round(longData.expires_in / 86400) : 60;

    // 3단계: Facebook 페이지 목록 조회
    const pagesRes = await fetch(`${FB_API}/me/accounts?access_token=${longToken}`);
    const pagesData = await pagesRes.json();
    const pages = pagesData.data || [];

    // 4단계: 각 페이지에서 Instagram 비즈니스 계정 찾기
    let igAccountId = "";
    let igUsername  = "";
    let pageToken   = "";

    for (const p of pages) {
      const igRes  = await fetch(`${FB_API}/${p.id}?fields=instagram_business_account&access_token=${longToken}`);
      const igData = await igRes.json();
      if (igData.instagram_business_account?.id) {
        igAccountId = igData.instagram_business_account.id;
        pageToken   = p.access_token || longToken;

        // IG 사용자명 조회
        try {
          const nameRes  = await fetch(`${FB_API}/${igAccountId}?fields=username&access_token=${longToken}`);
          const nameData = await nameRes.json();
          igUsername = nameData.username || "";
        } catch (_) {}
        break;
      }
    }

    const accountSection = igAccountId ? `
      <label style="margin-top:16px">Instagram 계정 ID</label>
      <div class="token-box" id="igid">${igAccountId}</div>
      <button onclick="navigator.clipboard.writeText('${igAccountId}');this.textContent='복사됨!';setTimeout(()=>this.textContent='계정 ID 복사',2000)" class="btn copy" style="background:#e1306c">
        계정 ID 복사
      </button>
    ` : `
      <div class="warn" style="margin-top:16px">
        ⚠️ Instagram 비즈니스 계정을 찾지 못했습니다.<br>
        Facebook 페이지에 Instagram 비즈니스/크리에이터 계정이 연결되어 있어야 합니다.
      </div>
    `;

    return res.status(200).send(page("연결 완료!", `
      <div class="icon ok">✓</div>
      <h2>Instagram 연결 완료!</h2>
      ${igUsername ? `<p class="sub">@${igUsername}${igAccountId ? ` (ID: ${igAccountId})` : ""}</p>` : ""}
      <p class="sub">장기 토큰 (${expiresDays}일 유효)</p>

      <label>Access Token</label>
      <div class="token-box" id="token">${longToken}</div>
      <button onclick="navigator.clipboard.writeText(document.getElementById('token').textContent);this.textContent='복사됨!';setTimeout(()=>this.textContent='토큰 복사',2000)" class="btn copy">
        토큰 복사
      </button>

      ${accountSection}

      <div class="info" style="margin-top:20px">
        <b>다음 단계</b><br>
        에덴 대시보드 → 통합 파이프라인 → 배포 단계 → Instagram 설정<br>
        → 액세스 토큰 + 계정 ID 붙여넣기
      </div>
    `));

  } catch (err) {
    return res.status(500).send(page("오류 발생", `
      <div class="icon err">✕</div>
      <h2>토큰 교환 실패</h2>
      <p class="sub">${err.message}</p>
      <div class="info">code는 1회용이며 약 5분간 유효합니다. 다시 인증을 시도해주세요.</div>
      <a href="/auth/instagram/" class="btn">다시 시도</a>
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
<title>${title} — Instagram 연동</title>
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
  .icon { font-size: 40px; margin-bottom: 16px; }
  .icon.ok  { color: #10b981; }
  .icon.err { color: #ef4444; }
  h2 { font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 8px; }
  .sub { font-size: 14px; color: #6b7280; margin-bottom: 20px; }
  label {
    display: block; text-align: left;
    font-size: 11px; font-weight: 600; color: #6b7280;
    text-transform: uppercase; letter-spacing: .05em; margin-bottom: 6px;
  }
  .token-box {
    background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 10px;
    padding: 12px 14px; font-family: 'Courier New', monospace;
    font-size: 12px; word-break: break-all; color: #1f2937;
    text-align: left; margin-bottom: 10px;
  }
  .btn {
    display: inline-block; background: #111827; color: white; border: none;
    border-radius: 10px; padding: 12px 28px; font-size: 14px; font-weight: 600;
    cursor: pointer; text-decoration: none; margin-bottom: 16px; transition: background .15s; width: 100%;
  }
  .btn:hover { background: #1f2937; }
  .btn.copy { background: #7c3aed; }
  .btn.copy:hover { background: #6d28d9; }
  .info {
    background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;
    padding: 14px 16px; font-size: 12px; color: #475569;
    text-align: left; line-height: 1.7;
  }
  .warn {
    background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px;
    padding: 12px 16px; font-size: 12px; color: #92400e;
    margin-bottom: 16px; text-align: left; line-height: 1.6;
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
