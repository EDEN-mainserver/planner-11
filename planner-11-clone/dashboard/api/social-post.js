// SNS 게시 통합 핸들러
// ?_fn=instagram → Instagram Graph API 게시
// ?_fn=threads   → Threads Graph API 게시
// ?_fn=iboss     → 아이보스 자동 포스팅

import { put, del } from "@vercel/blob";

export const config = { maxDuration: 120, api: { bodyParser: { sizeLimit: "25mb" } } };

// ═══════════════════════════════════════════════════════════════════════════════
// 공통 유틸
// ═══════════════════════════════════════════════════════════════════════════════
async function uploadToImgbb(b64Pure, apiKey) {
  const params = new URLSearchParams({ key: apiKey, image: b64Pure });
  const res = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body: params });
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();
  let data = null;
  if (contentType.includes("application/json")) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok || !data?.success) {
    const detail = data?.error || text.slice(0, 240).replace(/\s+/g, " ");
    throw new Error(`imgbb 업로드 실패 [${res.status}]: ${detail}`);
  }
  return data.data.url;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Instagram
// ═══════════════════════════════════════════════════════════════════════════════
const IG_API = "https://graph.facebook.com/v21.0";

async function igUploadHttpUrl(httpUrl, filename) {
  const res = await fetch(httpUrl);
  if (!res.ok) throw new Error(`이미지 다운로드 실패 [${res.status}]`);
  const { default: sharp } = await import("sharp");
  const buffer = await sharp(Buffer.from(await res.arrayBuffer())).jpeg({ quality: 92 }).toBuffer();
  if (process.env.IMGBB_API_KEY) {
    try {
      return { url: await uploadToImgbb(buffer.toString("base64"), process.env.IMGBB_API_KEY), blobUrl: null };
    } catch (err) {
      if (!process.env.BLOB_READ_WRITE_TOKEN) throw err;
      console.warn(`[IG-API] imgbb 실패, Blob 폴백: ${err.message}`);
    }
  }
  const blob = await put(`ig-temp/${filename.replace(/\.\w+$/, ".jpg")}`, buffer, { access: "public", contentType: "image/jpeg" });
  return { url: blob.url, blobUrl: blob.url };
}

async function igUploadBase64(base64DataUrl, filename) {
  const match = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("잘못된 이미지 형식");
  const { default: sharp } = await import("sharp");
  const buffer = await sharp(Buffer.from(match[2], "base64")).jpeg({ quality: 92 }).toBuffer();
  if (process.env.IMGBB_API_KEY) {
    try {
      return { url: await uploadToImgbb(buffer.toString("base64"), process.env.IMGBB_API_KEY), blobUrl: null };
    } catch (err) {
      if (!process.env.BLOB_READ_WRITE_TOKEN) throw err;
      console.warn(`[IG-API] imgbb 실패, Blob 폴백: ${err.message}`);
    }
  }
  const blob = await put(`ig-temp/${filename.replace(/\.\w+$/, ".jpg")}`, buffer, { access: "public", contentType: "image/jpeg" });
  return { url: blob.url, blobUrl: blob.url };
}

async function igCreateContainer(accountId, accessToken, imageUrl, caption, isCarouselItem) {
  const params = new URLSearchParams({ image_url: imageUrl, access_token: accessToken, media_type: "IMAGE" });
  if (isCarouselItem) params.set("is_carousel_item", "true");
  else if (caption) params.set("caption", caption);
  const res = await fetch(`${IG_API}/${accountId}/media`, { method: "POST", body: params });
  const data = await res.json();
  if (!res.ok || !data.id) throw new Error(`미디어 컨테이너 생성 실패 [${res.status}]: ${JSON.stringify(data.error || data)}`);
  return data.id;
}

async function igCreateCarousel(accountId, accessToken, childrenIds, caption) {
  const params = new URLSearchParams({ media_type: "CAROUSEL", children: childrenIds.join(","), caption: caption || "", access_token: accessToken });
  const res = await fetch(`${IG_API}/${accountId}/media`, { method: "POST", body: params });
  const data = await res.json();
  if (!res.ok || !data.id) throw new Error(data.error?.message || `캐러셀 생성 실패 (${res.status})`);
  return data.id;
}

async function igPublish(accountId, accessToken, creationId) {
  const params = new URLSearchParams({ creation_id: creationId, access_token: accessToken });
  const res = await fetch(`${IG_API}/${accountId}/media_publish`, { method: "POST", body: params });
  const data = await res.json();
  if (!res.ok || !data.id) throw new Error(data.error?.message || `게시 실패 (${res.status})`);
  return data.id;
}

async function igGetPermalink(mediaId, accessToken) {
  try {
    const res = await fetch(`${IG_API}/${mediaId}?fields=permalink&access_token=${accessToken}`);
    return (await res.json()).permalink || null;
  } catch { return null; }
}

async function handleInstagram(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
  const { accountId, accessToken, images, caption } = req.body || {};
  if (!accountId || !accessToken) return res.status(400).json({ error: "accountId와 accessToken이 필요합니다" });
  if (!images || images.length === 0) return res.status(400).json({ error: "이미지가 없습니다" });

  const blobUrls = [];
  const logs = [];
  const log = (msg, data) => { logs.push({ msg, data }); console.log(`[IG-API] ${msg}`, data !== undefined ? JSON.stringify(data) : ""); };

  try {
    if (!process.env.IMGBB_API_KEY && !process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error("IMGBB_API_KEY 또는 BLOB_READ_WRITE_TOKEN 환경변수가 필요합니다");
    }

    const uploadedUrls = await Promise.all(
      images.map(async (img, i) => {
        const filename = `card-${Date.now()}-${i}.jpg`;
        if (typeof img === "string" && img.startsWith("http")) {
          const { url, blobUrl } = await igUploadHttpUrl(img, filename);
          if (blobUrl) blobUrls.push(blobUrl);
          return url;
        }
        const { url, blobUrl } = await igUploadBase64(img, filename);
        if (blobUrl) blobUrls.push(blobUrl);
        return url;
      })
    );

    let publishedId;
    if (uploadedUrls.length === 1) {
      const containerId = await igCreateContainer(accountId, accessToken, uploadedUrls[0], caption || "", false);
      publishedId = await igPublish(accountId, accessToken, containerId);
    } else {
      const limited = uploadedUrls.slice(0, 10);
      const childIds = await Promise.all(limited.map((url) => igCreateContainer(accountId, accessToken, url, "", true)));
      const carouselId = await igCreateCarousel(accountId, accessToken, childIds, caption || "");
      publishedId = await igPublish(accountId, accessToken, carouselId);
    }

    const permalink = await igGetPermalink(publishedId, accessToken);
    if (blobUrls.length > 0) Promise.allSettled(blobUrls.map((url) => del(url))).catch(() => {});
    return res.status(200).json({ ok: true, mediaId: publishedId, permalink, logs });
  } catch (err) {
    log("오류 발생", { message: err.message });
    if (blobUrls.length > 0) Promise.allSettled(blobUrls.map((url) => del(url))).catch(() => {});
    return res.status(500).json({ error: err.message, logs });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Threads
// ═══════════════════════════════════════════════════════════════════════════════
const TH_API = "https://graph.threads.net/v1.0";

async function thUploadBase64(base64DataUrl, filename) {
  const match = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("잘못된 이미지 형식");
  if (process.env.IMGBB_API_KEY) {
    return { url: await uploadToImgbb(match[2], process.env.IMGBB_API_KEY), blobUrl: null };
  }
  const buffer = Buffer.from(match[2], "base64");
  const blob = await put(`th-temp/${filename}`, buffer, { access: "public", contentType: match[1] });
  return { url: blob.url, blobUrl: blob.url };
}

async function thCreateContainer(userId, accessToken, imageUrl, text, isCarouselItem) {
  const params = new URLSearchParams({ access_token: accessToken, media_type: "IMAGE", image_url: imageUrl });
  if (isCarouselItem) params.set("is_carousel_item", "true");
  else if (text) params.set("text", text);
  const res = await fetch(`${TH_API}/${userId}/threads`, { method: "POST", body: params });
  const data = await res.json();
  if (!res.ok || !data.id) throw new Error(data.error?.message || `Threads 컨테이너 생성 실패 (${res.status})`);
  return data.id;
}

async function thCreateCarousel(userId, accessToken, childrenIds, text) {
  const params = new URLSearchParams({ media_type: "CAROUSEL", children: childrenIds.join(","), access_token: accessToken });
  if (text) params.set("text", text);
  const res = await fetch(`${TH_API}/${userId}/threads`, { method: "POST", body: params });
  const data = await res.json();
  if (!res.ok || !data.id) throw new Error(data.error?.message || `Threads 캐러셀 생성 실패 (${res.status})`);
  return data.id;
}

async function thPublish(userId, accessToken, creationId) {
  const params = new URLSearchParams({ creation_id: creationId, access_token: accessToken });
  const res = await fetch(`${TH_API}/${userId}/threads_publish`, { method: "POST", body: params });
  const data = await res.json();
  if (!res.ok || !data.id) throw new Error(data.error?.message || `Threads 게시 실패 (${res.status})`);
  return data.id;
}

async function handleThreads(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
  const { userId, accessToken, images = [], text, caption } = req.body || {};
  const postText = text || caption || "";
  if (!userId || !accessToken) return res.status(400).json({ error: "userId와 accessToken이 필요합니다" });

  const logs = [];
  const log = (msg, data) => logs.push({ msg, data });
  const blobUrls = [];

  try {
    let publishedId;
    if (images.length === 0) {
      if (!postText.trim()) throw new Error("텍스트 또는 이미지가 필요합니다");
      const params = new URLSearchParams({ media_type: "TEXT", text: postText, access_token: accessToken });
      const containerRes = await fetch(`${TH_API}/${userId}/threads`, { method: "POST", body: params });
      const containerData = await containerRes.json();
      if (!containerRes.ok || !containerData.id) throw new Error(containerData.error?.message || `컨테이너 생성 실패 (${containerRes.status})`);
      await new Promise(r => setTimeout(r, 30000));
      publishedId = await thPublish(userId, accessToken, containerData.id);
    } else {
      const uploadedUrls = await Promise.all(
        images.map(async (img, i) => {
          if (typeof img === "string" && img.startsWith("http")) return img;
          const { url, blobUrl } = await thUploadBase64(img, `th-${Date.now()}-${i}.jpg`);
          if (blobUrl) blobUrls.push(blobUrl);
          return url;
        })
      );
      const limited = uploadedUrls.slice(0, 10);
      if (limited.length === 1) {
        const containerId = await thCreateContainer(userId, accessToken, limited[0], postText, false);
        await new Promise(r => setTimeout(r, 30000));
        publishedId = await thPublish(userId, accessToken, containerId);
      } else {
        const childIds = await Promise.all(limited.map((url) => thCreateContainer(userId, accessToken, url, "", true)));
        const carouselId = await thCreateCarousel(userId, accessToken, childIds, postText);
        await new Promise(r => setTimeout(r, 30000));
        publishedId = await thPublish(userId, accessToken, carouselId);
      }
    }

    if (blobUrls.length > 0) Promise.allSettled(blobUrls.map((url) => del(url))).catch(() => {});
    return res.status(200).json({ ok: true, mediaId: publishedId, logs });
  } catch (err) {
    log("오류 발생", { message: err.message });
    if (blobUrls.length > 0) Promise.allSettled(blobUrls.map((url) => del(url))).catch(() => {});
    return res.status(500).json({ error: err.message, logs });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 아이보스
// ═══════════════════════════════════════════════════════════════════════════════
const IBOSS_ORIGIN = "https://www.i-boss.co.kr";

function buildCookieStr(cookies) { return cookies.map((c) => c.split(";")[0]).join("; "); }

function extractCookies(resp, prev = []) {
  const raw = resp.headers.getSetCookie?.() || [];
  const map = {};
  for (const c of prev) { const [kv] = c.split(";"); map[kv.split("=")[0].trim()] = c; }
  for (const c of raw)  { const [kv] = c.split(";"); map[kv.split("=")[0].trim()] = kv; }
  return Object.values(map);
}

function extractHiddenFields(html, formSelector = null) {
  let scope = html;
  if (formSelector) {
    const idx = html.indexOf(formSelector);
    if (idx !== -1) {
      const s = html.lastIndexOf("<form", idx), e = html.indexOf("</form>", idx);
      if (s !== -1 && e !== -1) scope = html.slice(s, e + 7);
    }
  }
  const fields = {};
  let m;
  const regex = /<input[^>]+type=["']?hidden["']?[^>]*>/gi;
  while ((m = regex.exec(scope)) !== null) {
    const nameM = m[0].match(/name=["']([^"']+)["']/i);
    const valueM = m[0].match(/value=["']([^"']*)["']/i);
    if (nameM) fields[nameM[1]] = valueM ? valueM[1] : "";
  }
  return fields;
}

function extractFormAction(html, hint = "login") {
  const regex = /<form[^>]*action=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const action = m[1];
    if (action.toLowerCase().includes(hint) || m[0].toLowerCase().includes(hint)) return action;
  }
  return null;
}

async function handleIboss(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { id, pw, title, content, boardId = "2" } = req.body || {};
  if (!id || !pw) return res.status(400).json({ error: "아이디와 비밀번호를 입력해주세요." });
  if (!title || !content) return res.status(400).json({ error: "제목과 내용을 입력해주세요." });

  const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
  const baseHeaders = { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "ko-KR,ko;q=0.9" };
  let cookies = [];

  try {
    const mainResp = await fetch(`${IBOSS_ORIGIN}/`, { headers: baseHeaders });
    cookies = extractCookies(mainResp, cookies);

    const loginPageResp = await fetch(`${IBOSS_ORIGIN}/member/login`, { headers: { ...baseHeaders, Cookie: buildCookieStr(cookies), Referer: `${IBOSS_ORIGIN}/` } });
    const loginPageHtml = await loginPageResp.text();
    cookies = extractCookies(loginPageResp, cookies);

    const hiddenFields = extractHiddenFields(loginPageHtml, "login");
    const loginAction = extractFormAction(loginPageHtml, "login") || "/member/login_proc";
    const loginUrl = loginAction.startsWith("http") ? loginAction : `${IBOSS_ORIGIN}${loginAction}`;

    const loginResp = await fetch(loginUrl, {
      method: "POST",
      headers: { ...baseHeaders, "Content-Type": "application/x-www-form-urlencoded", Cookie: buildCookieStr(cookies), Referer: `${IBOSS_ORIGIN}/member/login`, Origin: IBOSS_ORIGIN },
      body: new URLSearchParams({ ...hiddenFields, mb_id: id, mb_password: pw, url: `${IBOSS_ORIGIN}/`, returnUrl: `${IBOSS_ORIGIN}/` }).toString(),
      redirect: "manual",
    });
    cookies = extractCookies(loginResp, cookies);

    const loginRespText = loginResp.status < 400 ? (loginResp.status === 302 || loginResp.status === 301 ? "" : await loginResp.text()) : await loginResp.text();
    if (["비밀번호가 틀렸", "아이디가 존재", "로그인 실패", "login_failed", "incorrect"].some(s => loginRespText.includes(s))) {
      return res.status(200).json({ success: false, error: "로그인 실패: 아이디 또는 비밀번호를 확인해주세요." });
    }

    const afterLoginUrl = loginResp.headers.get("location") || `${IBOSS_ORIGIN}/`;
    const afterLoginResp = await fetch(afterLoginUrl.startsWith("http") ? afterLoginUrl : `${IBOSS_ORIGIN}${afterLoginUrl}`, { headers: { ...baseHeaders, Cookie: buildCookieStr(cookies) }, redirect: "follow" });
    cookies = extractCookies(afterLoginResp, cookies);
    const afterLoginHtml = await afterLoginResp.text();

    if (!["logout", "로그아웃", "mypage", "마이페이지"].some(s => afterLoginHtml.includes(s))) {
      return res.status(200).json({ success: false, error: "로그인에 실패했습니다. 아이디/비밀번호를 확인해주세요." });
    }

    const writeUrls = [
      `${IBOSS_ORIGIN}/ab-board-write&bo_table=${boardId}`,
      `${IBOSS_ORIGIN}/board/write?bo_table=${boardId}`,
      `${IBOSS_ORIGIN}/bbs/write.php?bo_table=${boardId}`,
      `${IBOSS_ORIGIN}/ab-${boardId}-write`,
      `${IBOSS_ORIGIN}/write`,
    ];

    let writeHtml = "", workingWriteUrl = "";
    for (const wUrl of writeUrls) {
      try {
        const wr = await fetch(wUrl, { headers: { ...baseHeaders, Cookie: buildCookieStr(cookies), Referer: `${IBOSS_ORIGIN}/` } });
        const wHtml = await wr.text();
        cookies = extractCookies(wr, cookies);
        if (wHtml.includes('name="wr_subject"') || wHtml.includes('name="wr_content"') || wHtml.includes('name="title"') || wHtml.includes('name="content"')) {
          writeHtml = wHtml; workingWriteUrl = wUrl; break;
        }
      } catch { continue; }
    }

    if (!writeHtml) return res.status(200).json({ success: false, error: "글쓰기 페이지를 찾을 수 없습니다. 게시판 접근 권한을 확인해주세요." });

    const subjectField = writeHtml.includes('name="wr_subject"') ? "wr_subject" : "subject";
    const contentField = writeHtml.includes('name="wr_content"') ? "wr_content" : "content";
    const writeFormAction = extractFormAction(writeHtml, "write") || workingWriteUrl;
    const writeUrl = writeFormAction.startsWith("http") ? writeFormAction : `${IBOSS_ORIGIN}${writeFormAction}`;
    const writeHiddenFields = extractHiddenFields(writeHtml, subjectField);

    const postResp = await fetch(writeUrl, {
      method: "POST",
      headers: { ...baseHeaders, "Content-Type": "application/x-www-form-urlencoded", Cookie: buildCookieStr(cookies), Referer: workingWriteUrl, Origin: IBOSS_ORIGIN },
      body: new URLSearchParams({ ...writeHiddenFields, bo_table: boardId, [subjectField]: title, [contentField]: content, wr_option: "html1" }).toString(),
      redirect: "manual",
    });
    cookies = extractCookies(postResp, cookies);

    if (postResp.status >= 200 && postResp.status < 400) {
      const location = postResp.headers.get("location") || "";
      const postUrl = location ? (location.startsWith("http") ? location : `${IBOSS_ORIGIN}${location}`) : `${IBOSS_ORIGIN}/`;
      return res.status(200).json({ success: true, postUrl, message: "아이보스에 글이 등록되었습니다." });
    }

    const errText = await postResp.text();
    return res.status(200).json({ success: false, error: `글 등록 실패 (HTTP ${postResp.status}): ${errText.slice(0, 200)}` });
  } catch (e) {
    return res.status(200).json({ success: false, error: `오류: ${e.message}` });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 메인 라우터
// ═══════════════════════════════════════════════════════════════════════════════
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const fn = req.query._fn;
  if (fn === "instagram") return handleInstagram(req, res);
  if (fn === "threads")   return handleThreads(req, res);
  if (fn === "iboss")     return handleIboss(req, res);
  return res.status(400).json({ error: "_fn 파라미터가 필요합니다 (instagram | threads | iboss)" });
}
