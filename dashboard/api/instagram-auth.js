// Instagram OAuth 콜백 핸들러
// 흐름: Instagram 팝업 → 허용 → 여기로 리다이렉트 → 토큰 교환 → postMessage → 팝업 닫힘

const APP_ID     = process.env.INSTAGRAM_APP_ID     || "1268925518205893";
const APP_SECRET = process.env.INSTAGRAM_APP_SECRET || "";
const REDIRECT_URI = "https://planforge-ui.vercel.app/auth/instagram";

function popupHtml(data) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Instagram 연동 중...</title></head>
<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fafafa;">
  <div style="text-align:center;">
    ${data.error
      ? `<p style="color:#e53e3e;font-size:14px;">연동 실패: ${data.error}</p>`
      : `<p style="color:#38a169;font-size:14px;">✓ 연동 완료! 창이 닫힙니다...</p>`
    }
  </div>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage(
          ${JSON.stringify({ type: "instagram_auth", ...data })},
          "*"
        );
      }
    } catch(e) {}
    setTimeout(() => window.close(), 800);
  </script>
</body>
</html>`;
}

export default async function handler(req, res) {
  const { code, error, error_reason } = req.query;

  if (error) {
    return res.send(popupHtml({ error: error_reason || error }));
  }

  if (!code) {
    return res.status(400).send(popupHtml({ error: "인증 코드가 없습니다" }));
  }

  if (!APP_SECRET) {
    return res.send(popupHtml({ error: "서버 설정 오류: INSTAGRAM_APP_SECRET 미설정" }));
  }

  try {
    // 1. code → 단기 토큰 교환
    const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: APP_ID,
        client_secret: APP_SECRET,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
        code,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_message || tokenData.error_description || "토큰 교환 실패");
    }

    const shortToken = tokenData.access_token;
    const userId = String(tokenData.user_id || "");

    // 2. 단기 토큰 → 장기 토큰 (60일)
    const longRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${APP_SECRET}&access_token=${shortToken}`
    );
    const longData = await longRes.json();
    const accessToken = longData.access_token || shortToken;

    // 3. 사용자 정보 조회
    const userRes = await fetch(
      `https://graph.instagram.com/v22.0/me?fields=id,username&access_token=${accessToken}`
    );
    const userData = await userRes.json();
    const username = userData.username || "";
    const igUserId = String(userData.id || userId);

    return res.send(popupHtml({ accessToken, userId: igUserId, username }));
  } catch (e) {
    return res.send(popupHtml({ error: e.message }));
  }
}
