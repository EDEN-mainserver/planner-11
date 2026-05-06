// Vercel Serverless Function — 아이보스 자동 포스팅
// 1) 로그인 → 2) 세션 쿠키 획득 → 3) 글 등록 폼 추출 → 4) POST 제출

const IBOSS_ORIGIN = "https://www.i-boss.co.kr";

// ── 쿠키 배열 → 문자열 변환 ──
function buildCookieStr(cookies) {
  return cookies.map((c) => c.split(";")[0]).join("; ");
}

// ── 응답에서 Set-Cookie 누적 ──
function extractCookies(resp, prev = []) {
  const raw = resp.headers.getSetCookie?.() || [];
  const map = {};
  // 기존 쿠키
  for (const c of prev) {
    const [kv] = c.split(";");
    const [k] = kv.split("=");
    map[k.trim()] = c;
  }
  // 새 쿠키로 덮어씌우기
  for (const c of raw) {
    const [kv] = c.split(";");
    const [k] = kv.split("=");
    map[k.trim()] = kv;
  }
  return Object.values(map);
}

// ── HTML에서 hidden 필드 추출 ──
function extractHiddenFields(html, formSelector = null) {
  const fields = {};
  // 특정 폼 영역만 파싱 (formSelector가 있으면)
  let scope = html;
  if (formSelector) {
    const idx = html.indexOf(formSelector);
    if (idx !== -1) {
      const formStart = html.lastIndexOf("<form", idx);
      const formEnd = html.indexOf("</form>", idx);
      if (formStart !== -1 && formEnd !== -1) {
        scope = html.slice(formStart, formEnd + 7);
      }
    }
  }
  const regex = /<input[^>]+type=["']?hidden["']?[^>]*>/gi;
  let m;
  while ((m = regex.exec(scope)) !== null) {
    const tag = m[0];
    const nameM = tag.match(/name=["']([^"']+)["']/i);
    const valueM = tag.match(/value=["']([^"']*)["']/i);
    if (nameM) fields[nameM[1]] = valueM ? valueM[1] : "";
  }
  return fields;
}

// ── 폼 action 추출 ──
function extractFormAction(html, hint = "login") {
  const regex = /<form[^>]*action=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const action = m[1];
    if (action.toLowerCase().includes(hint) || m[0].toLowerCase().includes(hint)) {
      return action;
    }
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { id, pw, title, content, boardId = "2" } = req.body || {};

  if (!id || !pw) return res.status(400).json({ error: "아이디와 비밀번호를 입력해주세요." });
  if (!title || !content) return res.status(400).json({ error: "제목과 내용을 입력해주세요." });

  const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
  const baseHeaders = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9",
  };

  let cookies = [];

  try {
    // ══ STEP 1: 메인 페이지 방문 → 초기 쿠키 ══
    const mainResp = await fetch(`${IBOSS_ORIGIN}/`, { headers: baseHeaders });
    cookies = extractCookies(mainResp, cookies);

    // ══ STEP 2: 로그인 페이지 → 폼 필드 추출 ══
    const loginPageResp = await fetch(`${IBOSS_ORIGIN}/member/login`, {
      headers: { ...baseHeaders, Cookie: buildCookieStr(cookies), Referer: `${IBOSS_ORIGIN}/` },
    });
    const loginPageHtml = await loginPageResp.text();
    cookies = extractCookies(loginPageResp, cookies);

    // hidden 필드 (CSRF 토큰 등) 추출
    const hiddenFields = extractHiddenFields(loginPageHtml, "login");
    const loginAction = extractFormAction(loginPageHtml, "login") || "/member/login_proc";
    const loginUrl = loginAction.startsWith("http") ? loginAction : `${IBOSS_ORIGIN}${loginAction}`;

    // ══ STEP 3: 로그인 POST ══
    const loginBody = new URLSearchParams({
      ...hiddenFields,
      mb_id: id,
      mb_password: pw,
      url: `${IBOSS_ORIGIN}/`,
      // Gnuboard/XE 계열 공통 필드
      returnUrl: `${IBOSS_ORIGIN}/`,
    });

    const loginResp = await fetch(loginUrl, {
      method: "POST",
      headers: {
        ...baseHeaders,
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": buildCookieStr(cookies),
        "Referer": `${IBOSS_ORIGIN}/member/login`,
        "Origin": IBOSS_ORIGIN,
      },
      body: loginBody.toString(),
      redirect: "manual",
    });
    cookies = extractCookies(loginResp, cookies);

    // 로그인 성공 여부 확인 (리다이렉트 발생 or 세션 쿠키 생성)
    const loginRespText = loginResp.status < 400 ? await (
      loginResp.status === 302 || loginResp.status === 301
        ? Promise.resolve("")
        : loginResp.text()
    ) : await loginResp.text();

    const isLoginFailed =
      loginRespText.includes("비밀번호가 틀렸") ||
      loginRespText.includes("아이디가 존재") ||
      loginRespText.includes("로그인 실패") ||
      loginRespText.includes("login_failed") ||
      loginRespText.includes("incorrect");

    if (isLoginFailed) {
      return res.status(200).json({ success: false, error: "로그인 실패: 아이디 또는 비밀번호를 확인해주세요." });
    }

    // 리다이렉트 후 최종 페이지 방문 (쿠키 갱신)
    const afterLoginUrl = loginResp.headers.get("location") || `${IBOSS_ORIGIN}/`;
    const afterLoginResp = await fetch(
      afterLoginUrl.startsWith("http") ? afterLoginUrl : `${IBOSS_ORIGIN}${afterLoginUrl}`,
      { headers: { ...baseHeaders, Cookie: buildCookieStr(cookies) }, redirect: "follow" }
    );
    cookies = extractCookies(afterLoginResp, cookies);
    const afterLoginHtml = await afterLoginResp.text();

    // 로그인 성공 재확인 (닉네임/마이페이지 링크 확인)
    const loggedIn =
      afterLoginHtml.includes("logout") ||
      afterLoginHtml.includes("로그아웃") ||
      afterLoginHtml.includes("mypage") ||
      afterLoginHtml.includes("마이페이지");

    if (!loggedIn) {
      return res.status(200).json({ success: false, error: "로그인에 실패했습니다. 아이디/비밀번호를 확인해주세요." });
    }

    // ══ STEP 4: 글쓰기 페이지 접근 → 폼 필드 추출 ══
    // 아이보스 게시판 쓰기 URL 패턴 탐지
    const writeUrls = [
      `${IBOSS_ORIGIN}/ab-board-write&bo_table=${boardId}`,
      `${IBOSS_ORIGIN}/board/write?bo_table=${boardId}`,
      `${IBOSS_ORIGIN}/bbs/write.php?bo_table=${boardId}`,
      `${IBOSS_ORIGIN}/ab-${boardId}-write`,
      `${IBOSS_ORIGIN}/write`,
    ];

    let writeHtml = "";
    let workingWriteUrl = "";
    for (const wUrl of writeUrls) {
      try {
        const wr = await fetch(wUrl, {
          headers: { ...baseHeaders, Cookie: buildCookieStr(cookies), Referer: `${IBOSS_ORIGIN}/` },
        });
        const wHtml = await wr.text();
        cookies = extractCookies(wr, cookies);
        // 글쓰기 폼이 있는지 확인
        if (wHtml.includes('name="wr_subject"') || wHtml.includes('name="wr_content"') ||
            wHtml.includes('name="title"') || wHtml.includes('name="content"')) {
          writeHtml = wHtml;
          workingWriteUrl = wUrl;
          break;
        }
      } catch { continue; }
    }

    if (!writeHtml) {
      return res.status(200).json({ success: false, error: "글쓰기 페이지를 찾을 수 없습니다. 게시판 접근 권한을 확인해주세요." });
    }

    // 글쓰기 폼 필드명 탐지 (Gnuboard 스타일 or 커스텀)
    const subjectField = writeHtml.includes('name="wr_subject"') ? "wr_subject" : "subject";
    const contentField = writeHtml.includes('name="wr_content"') ? "wr_content" : "content";

    // 글쓰기 폼 action + hidden 필드
    const writeFormAction = extractFormAction(writeHtml, "write") || workingWriteUrl;
    const writeUrl = writeFormAction.startsWith("http") ? writeFormAction : `${IBOSS_ORIGIN}${writeFormAction}`;
    const writeHiddenFields = extractHiddenFields(writeHtml, subjectField);

    // ══ STEP 5: 글 등록 POST ══
    const postBody = new URLSearchParams({
      ...writeHiddenFields,
      bo_table: boardId,
      [subjectField]: title,
      [contentField]: content,
      wr_option: "html1", // HTML 허용 (텍스트만이면 '' 로)
    });

    const postResp = await fetch(writeUrl, {
      method: "POST",
      headers: {
        ...baseHeaders,
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": buildCookieStr(cookies),
        "Referer": workingWriteUrl,
        "Origin": IBOSS_ORIGIN,
      },
      body: postBody.toString(),
      redirect: "manual",
    });
    cookies = extractCookies(postResp, cookies);

    // 성공 여부: 302 리다이렉트 or 2xx 응답
    if (postResp.status >= 200 && postResp.status < 400) {
      const location = postResp.headers.get("location") || "";
      const postUrl = location
        ? (location.startsWith("http") ? location : `${IBOSS_ORIGIN}${location}`)
        : `${IBOSS_ORIGIN}/`;

      return res.status(200).json({
        success: true,
        postUrl,
        message: "아이보스에 글이 등록되었습니다.",
      });
    }

    const errText = await postResp.text();
    return res.status(200).json({
      success: false,
      error: `글 등록 실패 (HTTP ${postResp.status}): ${errText.slice(0, 200)}`,
    });

  } catch (e) {
    return res.status(200).json({ success: false, error: `오류: ${e.message}` });
  }
}
