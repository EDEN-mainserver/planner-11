// 풀가동화 콘텐츠 공유 파이프라인 (핸들러 아님 — 모듈)
// 네이버 검색 → Gemini 기획 → Imagen 이미지 생성 → IG/Threads 게시

import { Buffer } from "node:buffer";
import { put } from "@vercel/blob";
import { fetchPostContent } from "./naver.js";
// 수동 UI와 동일한 카드 디자인 재사용 — buildHighestTemplate가 cardHtmls를 _lastCardHtmls에 보관
import { buildHighestTemplate } from "../src/services/pipeline/cardNews.js";

// 네이버 블로그 글 본문 크롤 (모바일 페이지에서 본문 추출, 최대 1500자)
// 실패해도 빈 문자열만 리턴하므로 호출 측은 fallback 처리 가능
async function safeCrawlBody(url) {
  try {
    const body = await fetchPostContent(url);
    return String(body || "").slice(0, 1500);
  } catch {
    return "";
  }
}

// 슬라이드+배경 URL을 수동 UI와 동일한 카드 디자인으로 합성.
// 1) cards 배열 생성 (표지/본문/마무리 part 부여)
// 2) buildHighestTemplate가 _lastCardHtmls에 per-card HTML 보관
// 3) /api/html-screenshot 호출 → 각 카드를 1080×1350 PNG로 렌더
// 4) PNG base64를 Blob에 업로드 → 공개 URL 반환
async function composeCardImages({ slides, rawImageUrls, topic, brandName, runId }) {
  const cards = slides.map((s, i) => {
    const part = i === 0 ? "표지" : i === slides.length - 1 ? "마무리" : "본문";
    return {
      part,
      headline: String(s.title || "").trim(),
      body: String(s.body || "").trim(),
      imageUrl: rawImageUrls[i] || "",
    };
  });

  // 사이드이펙트로 _lastCardHtmls 채워짐
  buildHighestTemplate(topic, cards, brandName || "", null);
  const cardHtmls = Array.isArray(buildHighestTemplate._lastCardHtmls)
    ? buildHighestTemplate._lastCardHtmls
    : [];
  if (cardHtmls.length === 0) throw new Error("카드 HTML 생성 실패 (cardHtmls 비어있음)");

  // 셀프 호출용 base URL (Vercel 배포 환경에서는 VERCEL_URL이 자동 주입됨)
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.SELF_BASE_URL || "http://localhost:3000";

  console.log(`[pipeline] 카드 조립: ${cardHtmls.length}장 → puppeteer 캡처 호출(Blob 업로드 모드)...`);
  const shotRes = await fetch(`${baseUrl}/api/html-screenshot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ htmls: cardHtmls, format: "png", upload: true }),
  });
  const shotData = await shotRes.json().catch(() => ({}));
  if (!shotRes.ok || !Array.isArray(shotData.images) || shotData.images.length === 0) {
    throw new Error(`카드 캡처 실패: ${shotData.error || `HTTP ${shotRes.status}`}`);
  }
  // upload:true이므로 shotData.images가 이미 Blob URL 배열. 그대로 반환.
  return shotData.images;
}

const IG_API = "https://graph.facebook.com/v19.0";
const TH_API = "https://graph.threads.net/v1.0";

// ─── 네이버 블로그 검색 ───
async function searchNaver(query, env) {
  const url = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(query)}&display=10&sort=sim`;
  const res = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": env.NAVER_CLIENT_ID,
      "X-Naver-Client-Secret": env.NAVER_CLIENT_SECRET,
    },
  });
  if (!res.ok) throw new Error(`네이버 검색 실패 (${res.status})`);
  const data = await res.json();
  return (data.items || []).map((item) => ({
    title: item.title.replace(/<[^>]+>/g, ""),
    description: item.description.replace(/<[^>]+>/g, ""),
    link: item.link,
  }));
}

// ─── Gemini 텍스트 생성 ───
async function callGemini(prompt, env) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini 호출 실패 (${res.status})`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// ─── Imagen 이미지 생성 (단장) ───
async function generateImage(prompt, env) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict?key=${env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: "1:1",
        safetyFilterLevel: "BLOCK_ONLY_HIGH",
      },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Imagen 실패 (${res.status}): ${err.error?.message || JSON.stringify(err)}`);
  }
  const data = await res.json();
  const pred = data.predictions?.[0];
  if (!pred?.bytesBase64Encoded) throw new Error("Imagen 이미지 데이터 없음");
  return { base64: pred.bytesBase64Encoded, mimeType: pred.mimeType || "image/png" };
}

// ─── base64 → Vercel Blob 업로드 → 공개 URL ───
async function uploadImageToBlob(base64, mimeType, path) {
  const buffer = Buffer.from(base64, "base64");
  const blob = await put(path, buffer, { access: "public", contentType: mimeType });
  return blob.url;
}

// ─── Instagram 캐러셀 게시 ───
async function postToInstagram(account, imageUrls, caption) {
  const { igAccountId, igAccessToken } = account;
  if (!igAccountId || !igAccessToken) return { skipped: true, reason: "IG 계정 정보 없음" };

  // 캐러셀 아이템 컨테이너 생성
  const childIds = [];
  for (const url of imageUrls) {
    const params = new URLSearchParams({ image_url: url, is_carousel_item: "true", access_token: igAccessToken });
    const r = await fetch(`${IG_API}/${igAccountId}/media`, { method: "POST", body: params });
    const d = await r.json();
    if (!r.ok || !d.id) throw new Error(d.error?.message || "IG 아이템 컨테이너 생성 실패");
    childIds.push(d.id);
  }

  // 캐러셀 컨테이너 생성
  const carouselParams = new URLSearchParams({
    media_type: "CAROUSEL",
    children: childIds.join(","),
    caption: caption || "",
    access_token: igAccessToken,
  });
  const carouselRes = await fetch(`${IG_API}/${igAccountId}/media`, { method: "POST", body: carouselParams });
  const carouselData = await carouselRes.json();
  if (!carouselRes.ok || !carouselData.id) throw new Error(carouselData.error?.message || "IG 캐러셀 생성 실패");

  // 게시
  const publishParams = new URLSearchParams({ creation_id: carouselData.id, access_token: igAccessToken });
  const publishRes = await fetch(`${IG_API}/${igAccountId}/media_publish`, { method: "POST", body: publishParams });
  const publishData = await publishRes.json();
  if (!publishRes.ok || !publishData.id) throw new Error(publishData.error?.message || "IG 게시 실패");

  // permalink 조회
  try {
    const plRes = await fetch(`${IG_API}/${publishData.id}?fields=permalink&access_token=${igAccessToken}`);
    const plData = await plRes.json();
    return { mediaId: publishData.id, permalink: plData.permalink || null };
  } catch {
    return { mediaId: publishData.id, permalink: null };
  }
}

// ─── Threads 캐러셀 게시 ───
async function postToThreads(account, imageUrls, caption) {
  const { threadsUserId, threadsAccessToken } = account;
  if (!threadsUserId || !threadsAccessToken) return { skipped: true, reason: "Threads 계정 정보 없음" };

  // 캐러셀 아이템 컨테이너 생성
  const childIds = [];
  for (const url of imageUrls) {
    const params = new URLSearchParams({
      media_type: "IMAGE",
      image_url: url,
      is_carousel_item: "true",
      access_token: threadsAccessToken,
    });
    const r = await fetch(`${TH_API}/${threadsUserId}/threads`, { method: "POST", body: params });
    const d = await r.json();
    if (!r.ok || !d.id) throw new Error(d.error?.message || "Threads 아이템 컨테이너 생성 실패");
    childIds.push(d.id);
  }

  // 캐러셀 컨테이너 생성
  const carouselParams = new URLSearchParams({
    media_type: "CAROUSEL",
    children: childIds.join(","),
    access_token: threadsAccessToken,
  });
  if (caption) carouselParams.set("text", caption);
  const carouselRes = await fetch(`${TH_API}/${threadsUserId}/threads`, { method: "POST", body: carouselParams });
  const carouselData = await carouselRes.json();
  if (!carouselRes.ok || !carouselData.id) throw new Error(carouselData.error?.message || "Threads 캐러셀 생성 실패");

  // 게시
  const publishParams = new URLSearchParams({ creation_id: carouselData.id, access_token: threadsAccessToken });
  const publishRes = await fetch(`${TH_API}/${threadsUserId}/threads_publish`, { method: "POST", body: publishParams });
  const publishData = await publishRes.json();
  if (!publishRes.ok || !publishData.id) throw new Error(publishData.error?.message || "Threads 게시 실패");

  return { mediaId: publishData.id };
}

// ─── 공통 생성 단계 ───
export async function generateFullAutoAssets(account, env) {
  const settings = account.settings || {};
  const topics = (settings.topics || "마케팅 자동화").split(",").map((t) => t.trim());
  const topic = topics[Math.floor(Math.random() * topics.length)];
  const brandName = settings.brandName || "";
  const tone = settings.tone || "친근하고 전문적인";
  const slideCount = Math.min(Math.max(Number(settings.slideCount) || 5, 1), 10);
  // 기본 캡션 템플릿: 첫 슬라이드의 본문(body) + 해시태그. 슬라이드 제목 나열은 부자연스러움.
  const captionTemplate = settings.captionTemplate || "{firstBody}\n\n#{topicTag}";
  const runId = `run-${Date.now()}-${account.id}`;

  // 1. 네이버 검색 (리서치) + 상위 2건은 본문도 크롤
  console.log(`[pipeline] 네이버 검색: ${topic}`);
  const searchResults = await searchNaver(topic, env);
  const topArticles = searchResults.slice(0, 5);

  // 본문 크롤 (상위 2건 병렬, 실패하면 빈 문자열)
  console.log(`[pipeline] 본문 크롤 (상위 2건)...`);
  const bodies = await Promise.all(topArticles.slice(0, 2).map((a) => safeCrawlBody(a.link)));
  topArticles.forEach((a, i) => {
    a.body = bodies[i] || "";
  });

  const sourceUrls = topArticles.map((a) => a.link).filter(Boolean);
  const candidateId = `naver-ig-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const researchSummary = topArticles
    .map((r) => {
      const head = `- ${r.title}: ${r.description}`;
      return r.body ? `${head}\n  본문 발췌: ${r.body.slice(0, 800)}` : head;
    })
    .join("\n");

  // 2. Gemini: 슬라이드 JSON 기획
  console.log(`[pipeline] Gemini 슬라이드 기획...`);
  const planPrompt = `
당신은 SNS 카드뉴스 기획 전문가입니다.
다음 리서치 자료를 바탕으로 Instagram/Threads 카드뉴스 ${slideCount}장을 기획해주세요.

토픽: ${topic}
브랜드: ${brandName || "없음"}
톤앤매너: ${tone}

리서치 자료(상위 2건은 본문 발췌 포함):
${researchSummary}

[작성 규칙 — 매우 중요]
- 모든 title/body는 **순수 한국어**로 작성. 영어 단어는 일반적인 고유명사·기술용어만 허용.
- **환각 금지**: 리서치 자료에 없는 제품명·인물명·수치·기업명을 만들어내지 말 것.
- title은 자연스러운 한국어 문장 1줄(15~30자), 영문 슬러그·해시태그·이모지 금지.
- body는 2~3문장, 각 문장 마침표/물음표/느낌표로 종결.
- imagePrompt는 영어, 사진 분위기 설명만, 한국어/텍스트/로고 포함 금지.
- 첫 슬라이드(part="표지")는 후크 문장 + 줄바꿈 + 메인 카피 형식. 브랜드명을 title에 넣지 말 것.

반드시 JSON 배열로만 응답하세요. 각 슬라이드는 { "title": "제목", "body": "본문 2-3줄", "imagePrompt": "이미지 생성용 영문 프롬프트" } 형식입니다.
슬라이드 수: ${slideCount}장
JSON 배열만 반환, 다른 텍스트 없음.
`.trim();

  const planText = await callGemini(planPrompt, env);
  let slides;
  try {
    const jsonMatch = planText.match(/\[[\s\S]*\]/);
    slides = JSON.parse(jsonMatch ? jsonMatch[0] : planText);
  } catch (e) {
    throw new Error(`슬라이드 기획 JSON 파싱 실패: ${e.message}\n원본: ${planText.slice(0, 200)}`);
  }

  // 3. Imagen: 슬라이드별 배경 이미지 생성 (serial)
  console.log(`[pipeline] 배경 이미지 생성 (${slides.length}장)...`);
  const rawImageUrls = [];

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const imagePrompt = `${slide.imagePrompt || topic}, clean professional infographic card, Korean SNS style, minimalist, high quality`;
    console.log(`[pipeline] 배경 ${i + 1}/${slides.length} 생성중...`);
    const { base64, mimeType } = await generateImage(imagePrompt, env);
    const blobPath = `full-auto/images/${runId}/slide-${i + 1}.png`;
    const url = await uploadImageToBlob(base64, mimeType, blobPath);
    rawImageUrls.push(url);
  }

  // 3b. 카드 조립 — title/body/디자인 오버레이 입힌 합성 카드 PNG 생성
  // 실패 시 raw 배경 그대로 사용 (회귀 방지)
  let imageUrls = rawImageUrls;
  let compositionError = null;
  try {
    imageUrls = await composeCardImages({ slides, rawImageUrls, topic, brandName, runId });
    console.log(`[pipeline] 카드 조립 완료: ${imageUrls.length}장`);
  } catch (e) {
    compositionError = e.message;
    console.error(`[pipeline] 카드 조립 실패, raw 배경으로 폴백:`, e.message, e.stack?.split("\n").slice(0, 3).join(" | "));
    imageUrls = rawImageUrls;
  }

  // 4. 캡션 생성 — {title} / {body} / {firstBody} / {topicTag} 치환 지원
  const firstSlide = slides[0] || {};
  const captionBody = slides.map((s, i) => `${i + 1}. ${s.title}`).join("\n");
  const topicTag = String(topic || "").replace(/\s+/g, "");
  const caption = captionTemplate
    .replaceAll("{title}", firstSlide.title || topic)
    .replaceAll("{body}", captionBody)
    .replaceAll("{firstBody}", firstSlide.body || firstSlide.title || topic)
    .replaceAll("{topicTag}", topicTag || "카드뉴스");

  return {
    runId,
    topic,
    slideCount: slides.length,
    researchSummary,
    slides,
    imageUrls,
    caption,
    compositionError, // null이면 합성 성공, 메시지 있으면 raw 폴백된 이유 (디버깅용)
    composed: !compositionError,
    sourceInfo: {
      mode: "naver-search",
      label: "네이버 블로그",
      topicLabel: topic,
      candidateId,
      sourceUrls,
      bodyPreviews: topArticles
        .filter((a) => a.body)
        .map((a) => ({ url: a.link, title: a.title, preview: a.body.slice(0, 300) })),
      itemsCount: topArticles.length,
    },
  };
}

// ─── 메인 파이프라인 ───
export async function runFullAutoPipeline(account, env, options = {}) {
  const generated = await generateFullAutoAssets(account, env);

  // 5. Instagram 게시
  console.log(`[pipeline] Instagram 게시...`);
  const shouldPostInstagram =
    options.publishInstagram !== false &&
    options.targets?.instagram !== false &&
    Boolean(account.igAccountId && account.igAccessToken);
  const igResult = shouldPostInstagram
    ? await postToInstagram(account, generated.imageUrls, generated.caption)
    : { skipped: true, reason: "IG 게시 비활성" };

  // 6. Threads 게시
  console.log(`[pipeline] Threads 게시...`);
  const shouldPostThreads =
    options.publishThreads !== false &&
    options.targets?.threads !== false &&
    Boolean(account.threadsUserId && account.threadsAccessToken);
  const threadsResult = shouldPostThreads
    ? await postToThreads(account, generated.imageUrls, generated.caption)
    : { skipped: true, reason: "Threads 게시 비활성" };

  return {
    status: "success",
    ...generated,
    igPermalink: igResult?.permalink || null,
    igMediaId: igResult?.mediaId || null,
    threadsMediaId: threadsResult?.mediaId || null,
    igSkipped: igResult?.skipped || false,
    threadsSkipped: threadsResult?.skipped || false,
  };
}
