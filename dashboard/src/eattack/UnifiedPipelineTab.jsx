// 통합 카드뉴스 파이프라인
// 크롤링/리서치 → 기획 → 이미지 생성 → 카드 조립 → 배포
import { useEffect, useState } from "react";
import { callGemini, generateImage } from "../utils/gemini";
import LoginModal from "./LoginModal";
import { getSession, clearSession } from "../utils/authSession";
import TopicPicker from "./TopicPicker";
import { emitEAttackContext, summarizeText } from "./eattackContext";

// ── 상수 ──
const BATCH_SIZE = 3;
// 사용자별 IG 설정 키 (username 기반)
const igKey = (username) => `eden_ig_${username}_v1`;
const FONTS = ["sans", "serif", "mono"];
const FONT_LABELS = { sans: "고딕", serif: "명조", mono: "모노" };
const FONT_CSS = {
  sans: "system-ui, -apple-system, sans-serif",
  serif: "Georgia, serif",
  mono: "'Courier New', monospace",
};
const TONE_OPTS = [
  { v: "professional", l: "전문적" },
  { v: "friendly", l: "친근한" },
  { v: "emotional", l: "감성적" },
  { v: "bold", l: "강렬한" },
  { v: "luxury", l: "고급스러운" },
];
const PURPOSE_OPTS = [
  { v: "promo", l: "제품 홍보" },
  { v: "info", l: "정보 제공" },
  { v: "branding", l: "브랜딩" },
  { v: "event", l: "이벤트" },
  { v: "review", l: "고객 후기" },
];
const STEP_LABELS = ["설정", "리서치", "기획", "이미지", "조립", "배포"];
const threadsKey = (u) => `eden_threads_${u}_v1`;
const captionPromptKey = (u) => `eden_caption_prompt_${u}_v1`;
const DEFAULT_CAPTION_PROMPT =
  "기획을 바탕으로 인스타그램 게시용 캡션을 작성해줘. 첫 문장은 시선을 끌고, 본문은 2~4문장으로 자연스럽게 풀어 쓰고, 마지막에는 관련 해시태그 5~8개를 붙여줘.";

// ── 소셜 설정 로드/저장 (사용자별) ──
function loadSocial(keyFn, username) {
  try { return JSON.parse(localStorage.getItem(keyFn(username))) || {}; }
  catch { return {}; }
}
function saveSocial(keyFn, username, data) {
  localStorage.setItem(keyFn(username), JSON.stringify(data));
}
function loadLocalText(key) {
  try { return localStorage.getItem(key) || ""; }
  catch { return ""; }
}
function saveLocalText(key, value) {
  localStorage.setItem(key, value);
}

function normalizeInstagramToken(value) {
  return String(value || "").replace(/[\s\u200B-\u200D\uFEFF]+/g, "").trim();
}

function normalizeInstagramConfig(config = {}) {
  return {
    ...config,
    accessToken: normalizeInstagramToken(config.accessToken),
    accountId: String(config.accountId || "").trim(),
    username: String(config.username || "").trim(),
  };
}

// ── API 함수 ──
async function runResearch(topic) {
  let articlesText = "(네이버 검색 결과 없음)";
  try {
    const res = await fetch(
      `/api/naver-search?query=${encodeURIComponent(topic)}&display=10&sort=sim`
    );
    if (res.ok) {
      const data = await res.json();
      const items = (data.items || []).slice(0, 8);
      if (items.length > 0) {
        articlesText = items
          .map(
            (a, i) =>
              `[${i + 1}] ${a.title?.replace(/<[^>]+>/g, "")} — ${a.description?.replace(/<[^>]+>/g, "")}`
          )
          .join("\n");
      }
    }
  } catch {
    // 검색 실패 시 Gemini 단독 생성으로 진행한다.
  }

  return callGemini(
    [
      {
        role: "user",
        content: `주제: "${topic}"\n\n검색 결과:\n${articlesText}\n\n카드뉴스 제작을 위한 리서치 보고서를 작성해줘. 핵심 메시지 5-7가지, 통계/수치, 독자 인사이트 중심으로. 마크다운 형식.`,
      },
    ],
    "콘텐츠 리서처. 카드뉴스 제작을 위한 핵심 정보를 추출·요약합니다."
  );
}

async function runPlanning(topic, research, slideCount, tone, purpose, brandName) {
  const raw = await callGemini(
    [
      {
        role: "user",
        content: `주제: "${topic}" | 브랜드: ${brandName || "브랜드"} | 톤: ${tone} | 목적: ${purpose}
리서치 요약:
${research}

${slideCount}장 카드뉴스 기획서를 JSON으로 작성해줘:
{
  "type": "나열형|스토리텔링형|집중형|문답형",
  "slides": [
    {
      "num": 1,
      "part": "표지|본문|마무리",
      "headline": "제목(한 줄, 12~15자 이내)",
      "body": "본문 — 표지/마무리는 한 줄 요약. 본문 슬라이드는 반드시 줄바꿈(\\n)으로 구분된 5개 항목으로 작성: 첫째줄=핵심요약(20자 이내), 둘째줄=소제목(15자 이내), 셋째~다섯째줄=세부내용(각 15~20자 이내), 전체 80자 이내",
      "imagePrompt": "영어로 이미지 설명, 사실적 사진 스타일, no text, no watermark"
    }
  ]
}
JSON만 반환.`,
      },
    ],
    "카드뉴스 기획 전문가. JSON만 반환합니다."
  );
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("기획서 파싱 실패 — 다시 시도해주세요");
  return parsePlanningJson(raw);
}

// ── 벤치마킹 디자인 → HTML 템플릿 추출 ──
function extractJsonObject(raw) {
  const text = String(raw || "").trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : "";
}

function normalizePlanData(planData) {
  const slides = Array.isArray(planData?.slides) ? planData.slides : [];
  return {
    ...planData,
    type: planData?.type || "카드뉴스",
    slides: slides.map((slide, i) => {
      const bodyLines = Array.isArray(slide.bodyLines)
        ? slide.bodyLines.map((line) => String(line || "").trim()).filter(Boolean)
        : [];
      return {
        ...slide,
        num: Number(slide.num) || i + 1,
        part: slide.part || (i === 0 ? "도입" : i === slides.length - 1 ? "마무리" : "본문"),
        headline: String(slide.headline || "").trim(),
        bodyLines,
        body: bodyLines.length ? bodyLines.join("\n") : String(slide.body || "").trim(),
        imagePrompt: String(slide.imagePrompt || "").trim(),
      };
    }),
  };
}

async function parsePlanningJson(raw) {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) throw new Error("기획서 파싱 실패 - JSON 응답이 없습니다. 다시 시도해주세요.");

  try {
    return normalizePlanData(JSON.parse(jsonText));
  } catch (firstError) {
    const repaired = await callGemini(
      [
        {
          role: "user",
          content: `다음 텍스트를 유효한 JSON으로 고쳐줘. 설명 없이 JSON만 반환해.\n\n${jsonText}`,
        },
      ],
      "JSON 복구 전문가. 유효한 JSON만 반환합니다."
    );
    const repairedJson = extractJsonObject(repaired);
    try {
      return normalizePlanData(JSON.parse(repairedJson));
    } catch {
      throw new Error(`기획서 JSON 파싱 실패: ${firstError.message}`);
    }
  }
}

async function analyzeDesignToTemplate(base64, mimeType) {
  const raw = await callGemini(
    [
      {
        role: "user",
        content: `첨부한 카드뉴스 디자인 이미지를 분석해서, 이 디자인을 그대로 재현하는 HTML+CSS 카드 템플릿을 만들어주세요.

조건:
- 카드 1장 크기: width 1080px, height 1350px
- 배경색, 텍스트 색상, 레이아웃, 폰트 크기, 여백, 시각 구성요소를 최대한 동일하게 재현
- 텍스트 내용은 다음 플레이스홀더로 대체 (이 문자열이 그대로 HTML에 삽입됨):
  CARD_NUM → 슬라이드 번호 (예: 01, 02)
  CARD_HEADLINE → 메인 제목
  CARD_BODY → 본문 텍스트
  CARD_BRAND → 브랜드명
- 배경 이미지가 있는 경우 CARD_IMAGE_URL 플레이스홀더 사용 (없으면 배경색/그라디언트 유지)
- 외부 CDN/폰트 없이 standalone
- <style> 태그와 <div class="card"> 블록만 반환 (<html>/<body> 태그 없음)

반드시 \`\`\`html 코드블록으로만 반환하세요.`,
        inlineImages: [{ mimeType, base64 }],
      },
    ],
    "카드뉴스 디자인 분석 및 HTML 재현 전문가. 이미지에서 정확한 디자인을 추출합니다."
  );
  const match = raw.match(/```html\n?([\s\S]+?)```/);
  return match ? match[1].trim() : raw.trim();
}

// ── 벤치마킹 템플릿으로 HTML 빌드 ──
function buildHtmlFromTemplate(slides, template, topicStr, brandStr) {
  const esc = (s) =>
    String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const brand = esc(brandStr || "브랜드");
  const cardBlocks = slides
    .map((s, i) => {
      let card = template;
      card = card.split("CARD_NUM").join(String(i + 1).padStart(2, "0"));
      card = card.split("CARD_HEADLINE").join(esc(s.headline));
      card = card.split("CARD_BODY").join(esc(s.body || ""));
      card = card.split("CARD_BRAND").join(brand);
      card = card.split("CARD_IMAGE_URL").join(s.imageUrl || "");
      return card;
    })
    .join("\n\n");
  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><title>${esc(topicStr)} — 카드뉴스</title>
<style>body{background:#111;padding:20px;display:flex;flex-wrap:wrap;gap:16px;margin:0}</style>
</head>
<body>${cardBlocks}</body>
</html>`;
}

async function generateOneImage(prompt) {
  return generateImage(`${prompt}, no text, no watermark, photorealistic, high quality`, "3:4");
}

// ── HTML 카드뉴스 빌드 (브랜드 컬러 2개 + 폰트 지원) ──
function buildHtmlCardNews(topic, cards, brandName, color1, color2, font) {
  const brand = brandName || "브랜드";
  const fontFamily = FONT_CSS[font] || FONT_CSS.sans;

  const escHtml = (s) =>
    String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const cardBlocks = cards
    .map((card, i) => {
      const isDark = i % 2 === 0;
      const bg = isDark ? "#0A0A0A" : "#FAFAFA";
      const tc = isDark ? "#ffffff" : "#0A0A0A";
      const isCover = card.part === "표지";
      const isClosing = card.part === "마무리";

      const imgBlock = card.imageUrl
        ? `<div class="img-wrap">
            <img src="${card.imageUrl}" alt="${escHtml(card.headline)}" />
            <div class="img-ov"></div>
          </div>`
        : `<div class="img-placeholder" style="background:linear-gradient(135deg,${color1}cc,${color2}55)"></div>`;

      return `
  <div class="card" style="background:${bg};color:${tc}">
    ${isClosing ? "" : imgBlock}
    ${
      isClosing
        ? `<div class="card-inner closing" style="background:linear-gradient(160deg,${color1},${color2}88)">
          <p class="num" style="color:rgba(255,255,255,0.5)">${i + 1} / ${cards.length}</p>
          <h2 class="headline" style="color:#fff">${escHtml(card.headline)}</h2>
          ${card.body ? `<p class="body" style="color:rgba(255,255,255,0.85)">${escHtml(card.body)}</p>` : ""}
          <p class="brand-name" style="color:#fff">${escHtml(brand)}</p>
        </div>`
        : `<div class="card-inner ${isCover ? "cover" : "content"}">
          <p class="num" style="color:${isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)"}">${i + 1} / ${cards.length}</p>
          <h2 class="headline" style="color:${isCover ? "#fff" : tc}">${escHtml(card.headline)}</h2>
          ${card.body ? `<p class="body" style="color:${isCover ? "rgba(255,255,255,0.9)" : isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.7)"}">${escHtml(card.body)}</p>` : ""}
          ${i === cards.length - 1 ? `<p class="brand-name" style="color:${color1}">${escHtml(brand)}</p>` : ""}
        </div>`
    }
  </div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${escHtml(topic)} — 카드뉴스</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #111;
    padding: 20px;
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    font-family: ${fontFamily};
  }
  .card {
    width: 1080px;
    height: 1350px;
    position: relative;
    overflow: hidden;
    flex-shrink: 0;
    border-radius: 4px;
  }
  .img-wrap {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 58%;
  }
  .img-wrap img {
    width: 100%; height: 100%;
    object-fit: cover;
    display: block;
  }
  .img-ov {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 70%;
    background: linear-gradient(transparent, rgba(0,0,0,0.75));
  }
  .img-placeholder {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
  }
  .card-inner {
    position: absolute;
    left: 0; right: 0; bottom: 0;
    padding: 56px 60px;
    z-index: 10;
  }
  .card-inner.cover {
    top: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }
  .card-inner.closing {
    top: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
  }
  .num {
    font-size: 28px;
    margin-bottom: 24px;
    letter-spacing: 0.05em;
  }
  .headline {
    font-size: 72px;
    font-weight: 700;
    line-height: 1.15;
    margin-bottom: 28px;
    word-break: keep-all;
  }
  .body {
    font-size: 40px;
    line-height: 1.7;
    word-break: keep-all;
    margin-bottom: 20px;
  }
  .brand-name {
    font-size: 32px;
    font-weight: 700;
    letter-spacing: 0.08em;
    margin-top: 20px;
  }
</style>
</head>
<body>
${cardBlocks}
</body>
</html>`;
}

// ── 프리미엄 인스타 템플릿 빌드 (커버/본문/CTA) — 레퍼런스 디자인 기반 ──
function buildPremiumTemplate(topic, cards, brandName, accentColor) {
  const accent = accentColor || "#9b8eff";
  const brand = brandName || "브랜드";
  const esc = (s) =>
    String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const clampStyle = (lines) =>
    `display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:${lines};overflow:hidden;`;
  // 액센트 컬러 → rgba 사용을 위해 RGB 추출
  const ah = accent.replace("#", "");
  const accentRgb = `${parseInt(ah.slice(0,2),16)},${parseInt(ah.slice(2,4),16)},${parseInt(ah.slice(4,6),16)}`;

  let chapterIdx = 0;
  const bodyCards = cards.filter((c) => c.part !== "표지" && c.part !== "마무리");

  const blocks = cards.map((card, i) => {
    const isCover = card.part === "표지";
    const isCTA = card.part === "마무리";
    const isBody = !isCover && !isCTA;
    if (isBody) chapterIdx++;
    const chNum = String(chapterIdx).padStart(2, "0");

    // ── 커버 ──
    if (isCover) {
      const previewChips = bodyCards.slice(0, 3).map((bc, ci) => {
        const chipSub = (bc.body || "").split(/[·•\n]/)[0].trim();
        return `
        <div style="display:flex;align-items:center;gap:14px;
          background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);
          border-radius:12px;padding:14px 22px;overflow:hidden;">
          <div style="width:32px;height:32px;background:${accent};border-radius:8px;
            display:flex;align-items:center;justify-content:center;
            font-size:15px;font-weight:800;color:#fff;flex-shrink:0;">${ci + 1}</div>
          <span style="font-size:22px;font-weight:600;color:rgba(255,255,255,.85);line-height:1.25;
            ${clampStyle(1)}flex:1;min-width:0;">${esc(bc.headline)}</span>
          ${chipSub ? `<span style="font-size:17px;color:rgba(255,255,255,.35);line-height:1.25;white-space:nowrap;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;max-width:200px;">${esc(chipSub)}</span>` : ""}
        </div>`;
      }).join("");

      return `
<div style="width:1080px;height:1350px;overflow:hidden;position:relative;background:#080812;
  display:flex;flex-direction:column;justify-content:flex-end;padding:72px 72px 90px;
  font-family:'Noto Sans KR',sans-serif;flex-shrink:0;">
  ${card.imageUrl ? `
  <img src="${card.imageUrl}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;" />
  <div style="position:absolute;inset:0;background:rgba(4,4,18,0.72);z-index:0;"></div>` : ""}
  <div style="position:absolute;inset:0;background:
    radial-gradient(ellipse 80% 60% at 110% -10%,rgba(120,80,255,.28) 0%,transparent 55%),
    radial-gradient(ellipse 60% 50% at -10% 110%,rgba(80,40,200,.2) 0%,transparent 55%),
    radial-gradient(ellipse 40% 40% at 50% 50%,rgba(60,20,120,.15) 0%,transparent 60%);"></div>
  <div style="position:absolute;inset:0;background-image:
    linear-gradient(rgba(155,142,255,.04) 1px,transparent 1px),
    linear-gradient(90deg,rgba(155,142,255,.04) 1px,transparent 1px);
    background-size:72px 72px;"></div>
  <div style="position:absolute;width:500px;height:500px;top:-180px;right:-160px;
    border-radius:50%;border:1px solid rgba(155,142,255,.12);"></div>
  <div style="position:absolute;width:700px;height:700px;top:-280px;right:-260px;
    border-radius:50%;border:1px solid rgba(155,142,255,.06);"></div>
  <div style="position:absolute;width:320px;height:320px;bottom:60px;left:-100px;
    border-radius:50%;border:1px solid rgba(155,142,255,.08);"></div>
  <div style="position:absolute;width:300px;height:300px;top:80px;right:80px;
    border-radius:50%;background:radial-gradient(circle,rgba(155,142,255,.18) 0%,transparent 70%);
    filter:blur(20px);"></div>
  <div style="position:absolute;top:64px;left:72px;z-index:10;display:inline-flex;align-items:center;
    gap:8px;border:1.5px solid rgba(155,142,255,.75);border-radius:50px;padding:10px 22px;
    color:#fff;font-size:20px;font-weight:700;letter-spacing:.12em;background:rgba(155,142,255,.1);">
    <span style="width:7px;height:7px;border-radius:50%;background:${accent};display:inline-block;flex-shrink:0;"></span>
    ${esc(brand).toUpperCase()}
  </div>
  <div style="position:relative;z-index:10;overflow:hidden;">
    <div style="font-size:24px;font-weight:500;color:rgba(255,255,255,.5);margin-bottom:14px;
      overflow:hidden;white-space:nowrap;letter-spacing:.03em;">${esc(topic)}</div>
    <div style="font-size:82px;font-weight:900;color:#fff;line-height:1.1;letter-spacing:-.025em;
      word-break:keep-all;${clampStyle(2)}margin-bottom:32px;">${esc(card.headline)}</div>
    ${previewChips ? `<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:40px;overflow:hidden;">${previewChips}</div>` : ""}
    <div style="display:inline-flex;align-items:center;gap:8px;
      background:linear-gradient(90deg,rgba(155,142,255,.2),rgba(100,70,220,.15));
      border:1px solid rgba(155,142,255,.3);border-radius:12px;padding:17px 26px;
      color:rgba(255,255,255,.85);font-size:22px;font-weight:500;overflow:hidden;white-space:nowrap;max-width:100%;">
      ${card.body ? esc(card.body) : "댓글 &amp; 팔로우로 더 많은 콘텐츠를"}
      <span style="color:${accent};font-weight:700;margin-left:6px;">&gt;&gt;</span>
    </div>
  </div>
</div>`;
    }

    // ── CTA ──
    if (isCTA) {
      const summaryChips = bodyCards.map((bc, ci) => {
        const firstBullet = (bc.body || "").split(/[·•\n]/)[0].trim();
        return `
        <div style="display:flex;align-items:center;gap:12px;background:#fff;
          border-radius:12px;padding:16px 20px;box-shadow:0 2px 12px rgba(0,0,0,.05);overflow:hidden;">
          <div style="width:32px;height:32px;background:${accent};border-radius:8px;
            display:flex;align-items:center;justify-content:center;
            font-size:15px;font-weight:800;color:#fff;flex-shrink:0;">${ci + 1}</div>
          <div style="font-size:21px;font-weight:800;color:#111;white-space:nowrap;
            overflow:hidden;text-overflow:ellipsis;">${esc(bc.headline)}</div>
          ${firstBullet ? `<div style="font-size:17px;color:#888;margin-left:auto;white-space:nowrap;
            overflow:hidden;text-overflow:ellipsis;flex-shrink:0;">${esc(firstBullet)}</div>` : ""}
        </div>`;
      }).join("");

      const handle = `@${esc(brand.toLowerCase().replace(/\s+/g, "_"))}`;

      return `
<div style="width:1080px;height:1350px;overflow:hidden;background:#f0f0f2;display:flex;
  flex-direction:column;align-items:center;justify-content:center;padding:0 90px;
  position:relative;font-family:'Noto Sans KR',sans-serif;flex-shrink:0;">
  <div style="position:absolute;top:60px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:12px;">
    <div style="font-size:20px;font-weight:800;color:#444;letter-spacing:.14em;">${esc(brand).toUpperCase()}</div>
    <div style="width:60px;height:1.5px;background:#ccc;"></div>
  </div>
  <div style="display:flex;flex-direction:column;gap:10px;width:100%;margin-bottom:40px;overflow:hidden;">
    ${summaryChips}
  </div>
  <div style="text-align:center;margin-bottom:40px;overflow:hidden;">
    <div style="font-size:30px;font-weight:700;color:#111;line-height:1.5;word-break:keep-all;${clampStyle(2)}">${esc(card.headline)}</div>
    ${card.body ? `<div style="font-size:24px;color:#888;line-height:1.5;margin-top:8px;word-break:keep-all;${clampStyle(2)}">${esc(card.body)}</div>` : ""}
  </div>
  <div style="background:#fff;border-radius:20px;padding:30px 36px;width:100%;
    box-shadow:0 4px 28px rgba(0,0,0,.08);overflow:hidden;">
    <div style="display:flex;align-items:center;gap:20px;">
      <div style="width:84px;height:84px;border-radius:50%;
        background:linear-gradient(135deg,${accent},#6b4fc8);
        display:flex;align-items:center;justify-content:center;
        flex-shrink:0;border:2px solid rgba(155,142,255,.3);">
        <span style="color:#fff;font-size:34px;font-weight:900;">${esc(brand).charAt(0)}</span>
      </div>
      <div style="flex:1;overflow:hidden;min-width:0;display:flex;flex-direction:column;gap:4px;">
        <div style="font-size:28px;font-weight:900;color:#111;line-height:1.1;
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(brand)}</div>
        <div style="font-size:16px;color:#666;line-height:1.25;word-break:keep-all;${clampStyle(1)}">${esc(topic)}</div>
      </div>
      <div style="background:#4c6ef5;color:#fff;font-size:21px;font-weight:700;
        padding:13px 26px;border-radius:11px;flex-shrink:0;white-space:nowrap;">Follow</div>
    </div>
  </div>
  <div style="border:2px solid #bbb;border-radius:50px;padding:13px 52px;
    font-size:24px;font-weight:600;color:#555;white-space:nowrap;overflow:hidden;margin-top:32px;">
    ${handle}
  </div>
  <div style="position:absolute;bottom:50px;left:0;right:0;text-align:center;
    font-size:19px;color:#bbb;font-weight:400;overflow:hidden;white-space:nowrap;">
    팔로우하고 더 많은 콘텐츠를 받아보세요
  </div>
</div>`;
    }

    // ── 본문 (다크 배경 + 브라우저 목업 부유) ──
    const nextCard = cards[i + 1];
    const teaserText = nextCard
      ? nextCard.part === "마무리" ? "마지막 정리로" : esc(nextCard.headline)
      : "다음 내용으로";

    const bullets = (card.body || "")
      .split(/[·•\n]/).map((l) => l.trim()).filter((l) => l.length > 0);

    // bullets[0]=요약, bullets[1]=소제목(3개 이상일 때), bullets[2..last-1]=스킬, bullets[last]=효과
    const summaryText  = bullets[0] || esc(card.headline);
    const pluginSub    = bullets.length >= 3 ? bullets[1] : "";
    const skillBullets = bullets.length >= 4 ? bullets.slice(2, bullets.length - 1).slice(0, 4) : [];
    const effectText   = bullets.length >= 2 ? bullets[bullets.length - 1] : `${esc(card.headline)} — 더 알아보세요`;

    // 배경 레이어
    const bgLayer = card.imageUrl
      ? `<img src="${card.imageUrl}" style="position:absolute;inset:0;width:100%;height:100%;
           object-fit:cover;z-index:0;" />
         <div style="position:absolute;inset:0;background:rgba(4,4,16,.80);z-index:1;"></div>`
      : `<div style="position:absolute;inset:0;z-index:0;background-image:
           linear-gradient(rgba(${accentRgb},.04) 1px,transparent 1px),
           linear-gradient(90deg,rgba(${accentRgb},.04) 1px,transparent 1px);
           background-size:64px 64px;"></div>
         <div style="position:absolute;inset:0;z-index:0;
           background:radial-gradient(ellipse 70% 45% at 50% 108%,rgba(${accentRgb},.14) 0%,transparent 60%);"></div>`;

    // ── 콘텐츠 시각화 — 카드 내용에 따라 자동 선택 ──
    const allText = [card.headline, ...(bullets || [])].join(' ');
    const isFolder  = /폴더|디렉토리|구조|파일|경로|프로젝트|셋업|setup|directory|folder/i.test(allText);
    const isSteps   = skillBullets.length >= 2 && /단계|순서|먼저|다음으로|마지막|절차|방법|step|과정/i.test(allText);
    const isStats   = skillBullets.some(b => /\d[\d,]*%|\d+배|\d+만|\d+억|\d+개|\d+명|\d+시간/.test(b));
    const isCompare = /\bvs\b|비교|차이점|장단점|vs\./.test(allText);

    const cmdList = skillBullets.length >= 1
      ? skillBullets
      : [summaryText, effectText].filter((t, ii, a) => t && a.indexOf(t) === ii);

    let contentHtml;

    if (isFolder) {
      // ── 폴더 구조 시각화 ──
      const rootName = esc(card.headline).slice(0, 16).replace(/\s/g, '-').toLowerCase() + '/';
      const items = cmdList.slice(0, 6).map((b, ii) => {
        const isFile = /\.\w{2,5}$/.test(b.split(' ')[0]) || /파일|\.md|\.json|\.js|\.py|\.ts/.test(b);
        const last = ii === cmdList.slice(0, 6).length - 1;
        return { prefix: last ? '└── ' : '├── ', icon: isFile ? '📄' : '📁',
          name: esc(b.slice(0, 22)), highlight: ii === 0, last };
      });
      contentHtml = `
      <div style="width:100%;flex:1;min-height:180px;display:flex;flex-direction:column;gap:10px;overflow:hidden;margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
          <div style="font-size:20px;font-weight:700;color:#222;">📁 구조 파악</div>
          <div style="background:#1a1a2e;color:#9b8eff;font-size:14px;font-weight:600;padding:4px 12px;border-radius:6px;white-space:nowrap;">directory</div>
        </div>
        <div style="flex:1;min-height:0;background:#0d1117;border-radius:14px;overflow:hidden;display:flex;flex-direction:column;">
          <div style="height:36px;background:#161b22;display:flex;align-items:center;padding:0 16px;gap:8px;flex-shrink:0;border-bottom:1px solid #21262d;">
            <div style="width:11px;height:11px;border-radius:50%;background:#ff5f57;"></div>
            <div style="width:11px;height:11px;border-radius:50%;background:#febc2e;"></div>
            <div style="width:11px;height:11px;border-radius:50%;background:#28c840;"></div>
            <div style="margin-left:10px;font-size:14px;color:#8b949e;font-family:'Courier New',monospace;">📁 ${rootName}</div>
          </div>
          <div style="flex:1;padding:14px 20px;overflow:hidden;display:flex;flex-direction:column;justify-content:center;gap:4px;">
            ${items.map(t => `
            <div style="display:flex;align-items:center;gap:6px;height:28px;">
              <span style="font-family:'Courier New',monospace;font-size:16px;color:${t.highlight ? '#ffa657' : '#4a5568'};flex-shrink:0;">${t.prefix}</span>
              <span style="font-size:16px;flex-shrink:0;">${t.icon}</span>
              <span style="font-family:'Courier New',monospace;font-size:16px;color:${t.highlight ? '#ffa657' : '#e6edf3'};font-weight:${t.highlight ? '700' : '400'};overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${t.name}</span>
              ${t.highlight ? `<span style="font-family:'Courier New',monospace;font-size:14px;color:#28c840;margin-left:8px;font-weight:700;">← 핵심</span>` : ''}
            </div>`).join('')}
          </div>
        </div>
      </div>`;

    } else if (isStats) {
      // ── 통계 카드 시각화 ──
      const statItems = cmdList.slice(0, 4);
      const statColors = [accent, '#22c55e', '#f59e0b', '#ec4899'];
      contentHtml = `
      <div style="width:100%;flex:1;min-height:180px;display:flex;flex-direction:column;gap:10px;overflow:hidden;margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
          <div style="font-size:20px;font-weight:700;color:#222;">📊 핵심 수치</div>
          <div style="background:#1a1a2e;color:#9b8eff;font-size:14px;font-weight:600;padding:4px 12px;border-radius:6px;white-space:nowrap;">stats</div>
        </div>
        <div style="flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;gap:10px;overflow:hidden;">
          ${statItems.map((b, ii) => {
            const numMatch = b.match(/(\d[\d,]*%?|\d+배|\d+만|\d+억|\d+개|\d+명|\d+시간)/);
            const num = numMatch ? numMatch[1] : `0${ii+1}`;
            const label = b.replace(num, '').trim().slice(0, 28) || esc(b).slice(0, 28);
            return `<div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:14px;padding:22px 16px 16px;display:flex;flex-direction:column;justify-content:flex-start;gap:10px;overflow:hidden;">
              <div style="font-size:36px;font-weight:900;color:${statColors[ii % 4]};line-height:1;margin-bottom:6px;overflow:hidden;white-space:nowrap;">${esc(num)}</div>
              <div style="font-size:16px;color:#aaa;word-break:keep-all;line-height:1.35;${clampStyle(1)}">${esc(label)}</div>
            </div>`;
          }).join('')}
        </div>
      </div>`;

    } else if (isSteps) {
      // ── 단계별 타임라인 시각화 ──
      const stepItems = cmdList.slice(0, 5);
      contentHtml = `
      <div style="width:100%;flex:1;min-height:180px;display:flex;flex-direction:column;gap:10px;overflow:hidden;margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
          <div style="font-size:20px;font-weight:700;color:#222;">⚡ 실행 순서</div>
          <div style="background:#1a1a2e;color:#9b8eff;font-size:14px;font-weight:600;padding:4px 12px;border-radius:6px;white-space:nowrap;">${stepItems.length} steps</div>
        </div>
        <div style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:6px;overflow:hidden;">
          ${stepItems.map((b, ii) => `
          <div style="display:flex;align-items:flex-start;gap:12px;overflow:hidden;">
            <div style="width:30px;height:30px;border-radius:50%;background:${accent};color:#fff;font-weight:700;font-size:15px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${ii + 1}</div>
            ${ii < stepItems.length - 1 ? `<div style="position:absolute;"></div>` : ''}
            <div style="flex:1;background:#f8f9fa;border-radius:10px;padding:8px 14px;min-height:30px;display:flex;align-items:center;overflow:hidden;">
              <span style="font-size:17px;color:#222;font-weight:500;word-break:keep-all;line-height:1.25;${clampStyle(2)}">${esc(b)}</span>
            </div>
          </div>`).join('')}
        </div>
      </div>`;

    } else if (isCompare) {
      // ── 비교 시각화 ──
      const half = Math.ceil(cmdList.length / 2);
      const leftItems  = cmdList.slice(0, half);
      const rightItems = cmdList.slice(half);
      contentHtml = `
      <div style="width:100%;flex:1;min-height:180px;display:flex;flex-direction:column;gap:10px;overflow:hidden;margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
          <div style="font-size:20px;font-weight:700;color:#222;">⚖️ 비교 분석</div>
          <div style="background:#1a1a2e;color:#9b8eff;font-size:14px;font-weight:600;padding:4px 12px;border-radius:6px;white-space:nowrap;">compare</div>
        </div>
        <div style="flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;gap:10px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:8px;overflow:hidden;">
            <div style="font-size:14px;color:#ff7b72;font-weight:700;letter-spacing:.08em;flex-shrink:0;">Before</div>
            ${leftItems.map(b => `<div style="font-size:15px;color:#ccc;word-break:keep-all;line-height:1.4;${clampStyle(2)}">· ${esc(b)}</div>`).join('')}
          </div>
          <div style="background:linear-gradient(135deg,#0d2a1a,#0a2016);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:8px;overflow:hidden;">
            <div style="font-size:14px;color:#7ee787;font-weight:700;letter-spacing:.08em;flex-shrink:0;">After</div>
            ${rightItems.map(b => `<div style="font-size:15px;color:#ccc;word-break:keep-all;line-height:1.4;${clampStyle(2)}">· ${esc(b)}</div>`).join('')}
          </div>
        </div>
      </div>`;

    } else {
      // ── 기본: 코드 에디터 (key: value) ──
      const keyNames = ['auto-plan','auto-review','auto-debug','auto-test','auto-commit','auto-deploy','multi-agent','pdca-mode'];
      const valColors = ['#a5d6ff','#7ee787','#ffa657','#ff7b72','#d2a8ff','#a5d6ff'];
      let lineNum = 1;
      const headerLines = [
        { type: 'comment', text: '# CLAUDE.md — 바로 붙여넣기 가능한 설정' },
        { type: 'comment', text: `# Plugin: ${esc(card.headline).slice(0, 20)}` },
        { type: 'blank' },
      ];
      const codeLines = [
        ...headerLines,
        ...cmdList.map((cmd, ii) => ({ type: 'setting', key: keyNames[ii] || `feature-${ii+1}`, value: esc(cmd), valColor: valColors[ii % valColors.length] })),
        { type: 'blank' },
        { type: 'bool', key: 'hooks-enabled', value: 'true' },
      ];
      const renderLine = (line) => {
        const n = lineNum++;
        const numHtml = `<span style="color:#4a5568;font-size:16px;font-family:'Courier New',monospace;width:32px;text-align:right;padding-right:16px;flex-shrink:0;user-select:none;">${n}</span>`;
        if (line.type === 'blank') return `<div style="display:flex;align-items:center;height:26px;">${numHtml}</div>`;
        if (line.type === 'comment') return `<div style="display:flex;align-items:center;height:28px;">${numHtml}<span style="color:#6e7681;font-size:16px;font-family:'Courier New',monospace;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${line.text}</span></div>`;
        if (line.type === 'bool') return `<div style="display:flex;align-items:center;height:28px;">${numHtml}<span style="color:#79c0ff;font-size:16px;font-family:'Courier New',monospace;">${line.key}</span><span style="color:#e6edf3;font-size:16px;font-family:'Courier New',monospace;">: </span><span style="color:#ff7b72;font-size:16px;font-family:'Courier New',monospace;">${line.value}</span></div>`;
        return `<div style="display:flex;align-items:flex-start;min-height:28px;padding:2px 0;">${numHtml}<span style="color:#79c0ff;font-size:16px;font-family:'Courier New',monospace;flex-shrink:0;">${line.key}</span><span style="color:#e6edf3;font-size:16px;font-family:'Courier New',monospace;flex-shrink:0;">: </span><span style="color:${line.valColor};font-size:15px;font-family:'Courier New',monospace;word-break:keep-all;line-height:1.45;${clampStyle(2)}flex:1;min-width:0;">&quot;${line.value}&quot;</span></div>`;
      };
      contentHtml = `
      <div style="width:100%;flex:1;min-height:180px;display:flex;flex-direction:column;gap:10px;overflow:hidden;margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
          <div style="font-size:20px;font-weight:700;color:#222;">⌨️ 바로 써보세요</div>
          <div style="background:#1a1a2e;color:#9b8eff;font-size:14px;font-weight:600;padding:4px 12px;border-radius:6px;white-space:nowrap;">CLAUDE.md</div>
        </div>
        <div style="flex:1;min-height:0;background:#0d1117;border-radius:14px;overflow:hidden;display:flex;flex-direction:column;">
          <div style="height:36px;background:#161b22;display:flex;align-items:center;padding:0 16px;gap:8px;flex-shrink:0;border-bottom:1px solid #21262d;">
            <div style="width:11px;height:11px;border-radius:50%;background:#ff5f57;"></div>
            <div style="width:11px;height:11px;border-radius:50%;background:#febc2e;"></div>
            <div style="width:11px;height:11px;border-radius:50%;background:#28c840;"></div>
            <div style="margin-left:10px;font-size:14px;color:#8b949e;font-family:'Courier New',monospace;">CLAUDE.md</div>
            <div style="margin-left:auto;width:7px;height:7px;border-radius:50%;background:#28c840;box-shadow:0 0 5px #28c840;"></div>
          </div>
          <div style="flex:1;padding:12px 12px 12px 0;overflow:hidden;display:flex;flex-direction:column;justify-content:center;gap:0;">
            ${codeLines.map(renderLine).join("")}
          </div>
        </div>
      </div>`;
    }

    return `
<div style="width:1080px;height:1350px;overflow:hidden;position:relative;background:#080814;
  display:flex;align-items:flex-start;justify-content:center;padding:44px 48px 0;
  font-family:'Noto Sans KR',sans-serif;flex-shrink:0;">
  ${bgLayer}
  <div style="width:984px;height:1258px;background:#fff;border-radius:20px;
    box-shadow:0 24px 80px rgba(0,0,0,.6);overflow:hidden;display:flex;
    flex-direction:column;position:relative;z-index:2;flex-shrink:0;">
    <div style="height:60px;background:#f4f4f4;border-bottom:1px solid #e0e0e0;
      display:flex;align-items:center;padding:0 22px;gap:14px;flex-shrink:0;">
      <div style="display:flex;gap:8px;">
        <div style="width:13px;height:13px;border-radius:50%;background:#ff5f57;"></div>
        <div style="width:13px;height:13px;border-radius:50%;background:#febc2e;"></div>
        <div style="width:13px;height:13px;border-radius:50%;background:#28c840;"></div>
      </div>
      <div style="flex:1;max-width:320px;height:32px;background:#e8e8e8;border-radius:8px;
        display:flex;align-items:center;justify-content:center;font-size:16px;color:#888;">insight</div>
    </div>
    <div style="height:1130px;overflow:hidden;padding:36px 52px 0;
      display:flex;flex-direction:column;align-items:center;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-shrink:0;">
        <div style="background:${accent};color:#fff;font-size:18px;font-weight:700;
          padding:7px 18px;border-radius:8px;letter-spacing:.05em;">Chapter ${chNum}</div>
        <div style="background:#1a1a2e;color:${accent};font-family:'Courier New',monospace;
          font-size:16px;padding:7px 14px;border-radius:8px;white-space:nowrap;overflow:hidden;">
          ${esc(topic.slice(0, 12))}
        </div>
      </div>
      <div style="font-size:52px;font-weight:900;color:#111;text-align:center;
        margin-bottom:4px;word-break:keep-all;overflow:hidden;flex-shrink:0;line-height:1.1;">${esc(card.headline)}</div>
      ${pluginSub
        ? `<div style="font-size:22px;font-weight:400;color:#666;text-align:center;
             margin-bottom:14px;word-break:keep-all;overflow:hidden;flex-shrink:0;">${esc(pluginSub)}</div>`
        : `<div style="margin-bottom:14px;flex-shrink:0;"></div>`}
    <div style="width:100%;background:linear-gradient(135deg,#1a1a2e,#16213e);
        border-radius:16px;padding:18px 24px;margin-bottom:16px;overflow:hidden;flex-shrink:0;">
        <div style="font-size:16px;color:${accent};font-weight:700;letter-spacing:.08em;margin-bottom:8px;">✦ 핵심 가치</div>
        <div style="font-size:24px;font-weight:700;color:#fff;line-height:1.45;
          word-break:keep-all;${clampStyle(2)}">${esc(summaryText)}</div>
      </div>
      ${contentHtml}
      <div style="width:100%;background:linear-gradient(90deg,#f0eeff,#e8e4ff);
        border:1.5px solid #c4b5fd;border-radius:12px;padding:12px 18px;
        margin-top:12px;margin-bottom:10px;
        display:flex;align-items:center;gap:12px;overflow:hidden;flex-shrink:0;">
        <span style="font-size:20px;flex-shrink:0;">💡</span>
        <div style="font-size:20px;color:#333;font-weight:600;word-break:keep-all;line-height:1.35;${clampStyle(2)}">${esc(effectText)}</div>
      </div>
    </div>
    <div style="position:absolute;bottom:0;right:0;left:0;height:68px;
      background:linear-gradient(90deg,rgba(20,20,40,.93),rgba(50,30,120,.93));
      display:flex;align-items:center;justify-content:flex-end;padding:0 32px;
      color:#fff;font-size:22px;font-weight:500;white-space:nowrap;overflow:hidden;">
      ${teaserText} <span style="color:#c4b5fd;margin-left:6px;font-weight:700;">&gt;&gt;</span>
    </div>
  </div>
</div>`;
  });

  const CARD_HEAD = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box;margin:0;padding:0;}body{background:#111;}</style>
</head><body>`;

  // 개별 카드 HTML 배열 (미리보기용)
  buildPremiumTemplate._lastCardHtmls = blocks.map(
    (b) => `${CARD_HEAD}${b}</body></html>`
  );

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${esc(topic)} — 카드뉴스</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet">
<style>* { box-sizing:border-box; margin:0; padding:0; } body { background:#111; padding:20px; display:flex; flex-wrap:wrap; gap:16px; }</style>
</head>
<body>${blocks.join("\n")}</body>
</html>`;
}

// ── 공통 UI ──
function Spinner({ label, sub, gradient = "from-pink-500 to-rose-500" }) {
  return (
    <div className="flex flex-col items-center py-16 gap-4">
      <div
        className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg animate-pulse`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
        >
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-gray-700">{label}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function ErrorBox({ msg, onRetry }) {
  return (
    <div className="space-y-3">
      <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
        {msg}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="w-full py-2.5 bg-pink-500 text-white text-sm font-bold rounded-xl hover:bg-pink-600 transition-all"
        >
          다시 시도
        </button>
      )}
    </div>
  );
}

// ── 메인 컴포넌트 ──
export default function UnifiedPipelineTab() {
  // 세션 (로그인)
  const [session, setSession] = useState(() => getSession());

  // 파이프라인 단계 상태
  const [step, setStep] = useState("setup");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const [showTopicPicker, setShowTopicPicker] = useState(false);

  // 설정값
  const [topic, setTopic] = useState("");
  const [brandName, setBrandName] = useState("");
  const [color1, setColor1] = useState("#7c3aed");
  const [color2, setColor2] = useState("#ec4899");
  const [font, setFont] = useState("sans");
  const [tone, setTone] = useState("professional");
  const [purpose, setPurpose] = useState("info");
  const [slideCount, setSlideCount] = useState(7);

  // 결과물
  const [research, setResearch] = useState("");
  const [plan, setPlan] = useState(null);
  const [images, setImages] = useState([]);
  const [imgProg, setImgProg] = useState({ done: 0, total: 0 });
  const [cards, setCards] = useState([]); // 편집 가능한 카드 데이터
  const [htmlContent, setHtmlContent] = useState("");
  const [cardHtmls, setCardHtmls] = useState([]); // 카드별 개별 HTML (미리보기용)
  const [previewIdx, setPreviewIdx] = useState(0); // 현재 미리보기 중인 카드 인덱스

  // 템플릿 모드 (프리미엄 인스타 템플릿 vs 기존 AI 이미지)
  const [useTemplate, setUseTemplate] = useState(true);

  // 벤치마킹 디자인
  const [benchmarkImg, setBenchmarkImg] = useState(null); // { dataUrl, mime, base64 }
  const [benchmarkTemplate, setBenchmarkTemplate] = useState(null); // Gemini 추출 HTML 템플릿

  // 소셜 설정 (사용자별 로드)
  const [igConfig, setIgConfig]   = useState(() => normalizeInstagramConfig(loadSocial(igKey, getSession()?.username || "__guest")));
  const [thConfig, setThConfig]   = useState(() => loadSocial(threadsKey, getSession()?.username || "__guest"));
  const [igPosting, setIgPosting] = useState(false);
  const [igResult,  setIgResult]  = useState(null);
  const [igLogs,    setIgLogs]    = useState([]);
  const [thPosting, setThPosting] = useState(false);
  const [thResult, setThResult]   = useState(null);
  const [postCaption, setPostCaption] = useState("");
  const [captionPrompt, setCaptionPrompt] = useState(() =>
    loadLocalText(captionPromptKey(getSession()?.username || "__guest")) || DEFAULT_CAPTION_PROMPT
  );
  const [captionSaving, setCaptionSaving] = useState(false);
  const [captionGenerating, setCaptionGenerating] = useState(false);

  useEffect(() => {
    emitEAttackContext({
      page: "UnifiedPipelineTab",
      section: "이미지 > 통합 파이프라인",
      tab: "unified",
      step,
      mode: useTemplate ? "템플릿" : "AI 이미지",
      status: running ? "실행 중" : step,
      summary: [
        `주제 ${summarizeText(topic || "미입력", 60)}`,
        `브랜드 ${summarizeText(brandName || "미입력", 40)}`,
        `톤 ${tone}`,
        `목적 ${purpose}`,
        `슬라이드 ${slideCount}장`,
        `카드 ${cards.length}개`,
        thPosting ? "Threads 게시 중" : "",
      ].filter(Boolean).join(" · "),
    });
  }, [step, running, useTemplate, topic, brandName, tone, purpose, slideCount, cards.length, thPosting]);

  // 로그인 핸들러
  const handleLogin = (s) => {
    setSession(s);
    setIgConfig(normalizeInstagramConfig(loadSocial(igKey, s.username)));
    setThConfig(loadSocial(threadsKey, s.username));
    setCaptionPrompt(loadLocalText(captionPromptKey(s.username)) || DEFAULT_CAPTION_PROMPT);
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
  };

  // 로그인 안 된 경우 모달 표시
  if (!session) {
    return <LoginModal onLogin={handleLogin} />;
  }

  const run = async (fn) => {
    setRunning(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message || "알 수 없는 오류");
    } finally {
      setRunning(false);
    }
  };

  // ── plan → 편집가능 cards 배열 변환 ──
  function buildCards(planData, imageList) {
    return planData.slides.map((slide, i) => ({
      num: slide.num,
      part: slide.part,
      headline: slide.headline,
      body: slide.body || "",
      imagePrompt: slide.imagePrompt,
      imageUrl: imageList[i] || null,
      color1,
      color2,
      font,
    }));
  }

  // ── 단계 핸들러 ──
  const startResearch = () =>
    run(async () => {
      setStep("research");
      const summary = await runResearch(topic);
      setResearch(summary);
    });

  const startPlanning = () =>
    run(async () => {
      setStep("planning");
      const p = await runPlanning(topic, research, slideCount, tone, purpose, brandName);
      setPlan(p);
    });

  const startImages = () =>
    run(async () => {
      setStep("images");
      const slides = plan.slides;
      const results = new Array(slides.length).fill(null);
      setImages([...results]);
      setImgProg({ done: 0, total: slides.length });

      for (let i = 0; i < slides.length; i += BATCH_SIZE) {
        const batch = slides.slice(i, Math.min(i + BATCH_SIZE, slides.length));
        const settled = await Promise.allSettled(batch.map((s) => generateOneImage(s.imagePrompt)));
        settled.forEach((r, j) => {
          results[i + j] = r.status === "fulfilled" ? r.value : null;
        });
        setImages([...results]);
        setImgProg({ done: Math.min(i + BATCH_SIZE, slides.length), total: slides.length });
      }
    });

  const startAssembly = (imageList) => {
    const imgList = imageList || images;
    const assembled = buildCards(plan, imgList);
    setCards(assembled);
    const html = useTemplate && !benchmarkTemplate
      ? buildPremiumTemplate(topic, assembled, brandName, color1)
      : benchmarkTemplate
        ? buildHtmlFromTemplate(assembled, benchmarkTemplate, topic, brandName)
        : buildHtmlCardNews(topic, assembled, brandName, color1, color2, font);
    setHtmlContent(html);
    setCardHtmls(buildPremiumTemplate._lastCardHtmls || []);
    setPreviewIdx(0);
    setStep("assembly");
  };

  const updateCard = (idx, field, value) => {
    setCards((prev) => {
      const next = prev.map((c, i) =>
        i === idx ? { ...c, [field]: value } : c
      );
      // 템플릿 모드 분기
      const html = useTemplate && !benchmarkTemplate
        ? buildPremiumTemplate(topic, next, brandName, color1)
        : benchmarkTemplate
          ? buildHtmlFromTemplate(next, benchmarkTemplate, topic, brandName)
          : buildHtmlCardNews(topic, next, brandName, color1, color2, font);
      setHtmlContent(html);
      setCardHtmls(buildPremiumTemplate._lastCardHtmls || []);
      return next;
    });
  };

  const persistCaptionPrompt = async () => {
    const username = session?.username || "__guest";
    setCaptionSaving(true);
    try {
      const nextPrompt = String(captionPrompt || "").trim() || DEFAULT_CAPTION_PROMPT;
      saveLocalText(captionPromptKey(username), nextPrompt);
      setCaptionPrompt(nextPrompt);
    } finally {
      setCaptionSaving(false);
    }
  };

  const buildCaptionContext = () => {
    const sourceCards = cards.length > 0 ? cards : plan?.slides || [];
    const cardLines = sourceCards.map((card, i) => {
      const headline = String(card.headline || "").trim();
      const body = String(card.body || "").trim().replace(/\n+/g, " | ");
      return `${i + 1}. ${headline}${body ? ` / ${body}` : ""}`;
    }).filter(Boolean).join("\n");

    const researchText = String(research || "").trim();
    return [
      `주제: ${topic || ""}`,
      `브랜드: ${brandName || "브랜드"}`,
      `톤: ${tone}`,
      `목적: ${purpose}`,
      researchText ? `리서치 요약:\n${researchText}` : "",
      cardLines ? `카드 요약:\n${cardLines}` : "",
    ].filter(Boolean).join("\n\n");
  };

  const generateCaptionFromPrompt = async () => {
    if (!topic?.trim()) {
      setError("캡션을 만들 주제를 먼저 입력해주세요");
      return;
    }
    setCaptionGenerating(true);
    setError("");
    try {
      await persistCaptionPrompt();

      const sourceCards = cards.length > 0 ? cards : plan?.slides || [];
      const cardLines = sourceCards.map((card, i) => {
        const headline = String(card.headline || "").trim();
        const body = String(card.body || "").trim().replace(/\n+/g, " | ");
        return `${i + 1}. ${headline}${body ? ` / ${body}` : ""}`;
      }).join("\n");

      const rawPrompt = String(captionPrompt || "").trim() || DEFAULT_CAPTION_PROMPT;
      const filledPrompt = rawPrompt
        .replaceAll("{topic}", topic || "")
        .replaceAll("{brand}", brandName || "브랜드")
        .replaceAll("{tone}", tone || "")
        .replaceAll("{purpose}", purpose || "")
        .replaceAll("{research}", String(research || "").trim())
        .replaceAll("{cards}", cardLines);

      const result = await callGemini(
        [
          {
            role: "user",
            content: `아래 캡션 작성 지시를 가장 우선으로 따르고, 문맥을 참고해 게시용 캡션만 작성해줘.
추가 설명, 머리말, 따옴표, 코드블록 없이 캡션 본문만 출력해.
줄바꿈과 해시태그는 지시에 맞게 자연스럽게 포함해.

캡션 작성 지시:
${filledPrompt}

문맥:
${buildCaptionContext()}`,
          },
        ],
        "SNS 게시용 캡션 카피라이터. 사용자의 스타일 지시를 최우선으로 따르고, 결과물만 출력합니다."
      );

      setPostCaption(String(result || "").trim());
    } catch (e) {
      setError(e.message || "캡션 생성 실패");
    } finally {
      setCaptionGenerating(false);
    }
  };

  // 벤치마킹 이미지 업로드
  const handleBenchmarkFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("이미지 크기는 5MB 이하로 첨부해주세요");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) setBenchmarkImg({ dataUrl, mime: match[1], base64: match[2] });
    };
    reader.readAsDataURL(file);
  };

  // 벤치마킹 디자인으로 카드 생성
  const startBenchmarkImages = () =>
    run(async () => {
      setStep("images");
      setImgProg({ done: 0, total: plan.slides.length });
      // 1. Gemini Vision으로 디자인 분석
      const template = await analyzeDesignToTemplate(benchmarkImg.base64, benchmarkImg.mime);
      setBenchmarkTemplate(template);
      // 2. 템플릿 + 슬라이드 데이터로 카드 배열 생성
      const assembled = buildCards(plan, []);
      setCards(assembled);
      // 3. HTML 빌드
      const html = buildHtmlFromTemplate(assembled, template, topic, brandName);
      setHtmlContent(html);
      setImgProg({ done: plan.slides.length, total: plan.slides.length });
      setStep("assembly");
    });

  const postToThreads = async () => {
    if (!thConfig.userId || !thConfig.accessToken) {
      setError("스레드 사용자 ID와 액세스 토큰을 입력해주세요");
      return;
    }
    setThPosting(true);
    setThResult(null);
    setError("");
    try {
      // 1. cards[].imageUrl 우선 — AI 이미지 생성한 경우
      let imageList = cards.map((c) => c.imageUrl).filter(Boolean);

      // 2. imageUrl 없으면 cardHtmls(조립된 카드 HTML)를 스크린샷으로 변환
      if (imageList.length === 0) {
        const htmlsToShot = cardHtmls.length > 0 ? cardHtmls : null;
        if (!htmlsToShot) {
          throw new Error("게시할 이미지가 없습니다. 카드를 먼저 조립해주세요.");
        }
        const shotRes = await fetch("/api/html-screenshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ htmls: htmlsToShot }),
        });
        const shotData = await shotRes.json();
        if (!shotRes.ok) throw new Error(shotData.error || "카드 이미지 변환 실패");
        imageList = shotData.images;
      }

      if (imageList.length === 0) {
        throw new Error("변환된 이미지가 없습니다.");
      }

      const res = await fetch("/api/threads-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: thConfig.userId,
          accessToken: thConfig.accessToken,
          images: imageList,
          caption: postCaption || topic,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "스레드 게시 실패");
      setThResult({ status: "success", message: `스레드 게시 완료!${data.permalink ? ` → ${data.permalink}` : ""}`, permalink: data.permalink });
    } catch (e) {
      setError(e.message);
    } finally {
      setThPosting(false);
    }
  };

  const reset = () => {
    setStep("setup");
    setTopic("");
    setResearch("");
    setPlan(null);
    setImages([]);
    setCards([]);
    setHtmlContent("");
    setError("");
    setIgResult(null);
  };

  const postToInstagram = async () => {
    setIgPosting(true);
    setIgResult(null);
    setError("");
    setIgLogs([]);
    const log = (msg) => setIgLogs((p) => [...p, `[${new Date().toLocaleTimeString("ko-KR")}] ${msg}`]);

    try {
      log(`계정: @${igConfig.username || igConfig.accountId}`);

      // 1. imageUrl 있는 카드 먼저 수집
      let images = cards.map((c) => c.imageUrl).filter((u) => typeof u === "string" && u.length > 0);
      log(`카드 imageUrl 수집: ${images.length}개`);

      // 2. imageUrl 없으면 cardHtmls → 브라우저에서 html2canvas로 직접 캡처
      if (images.length === 0 && cardHtmls.length > 0) {
        log(`HTML 카드 감지 (${cardHtmls.length}장) → 브라우저 캡처 시작`);
        const { default: html2canvas } = await import("html2canvas");
        const targets = cardHtmls.slice(0, 10);
        for (let i = 0; i < targets.length; i++) {
          log(`카드 ${i + 1}/${targets.length} 캡처 중...`);
          const dataUrl = await new Promise((resolve, reject) => {
            const blob = new Blob([targets[i]], { type: "text/html" });
            const blobUrl = URL.createObjectURL(blob);
            const iframe = document.createElement("iframe");
            iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:1080px;height:1350px;border:none;z-index:-999;pointer-events:none;";
            iframe.src = blobUrl;
            iframe.onload = async () => {
              try {
                const doc = iframe.contentDocument;
                await doc.fonts.ready;
                await new Promise((r) => setTimeout(r, 1200));
                const canvas = await html2canvas(doc.documentElement, {
                  width: 1080, height: 1350, windowWidth: 1080, windowHeight: 1350,
                  scale: 1, useCORS: true, allowTaint: false, backgroundColor: "#080814",
                  logging: false, x: 0, y: 0,
                });
                URL.revokeObjectURL(blobUrl);
                iframe.remove();
                resolve(canvas.toDataURL("image/jpeg", 0.92));
              } catch (e) { URL.revokeObjectURL(blobUrl); iframe.remove(); reject(e); }
            };
            iframe.onerror = () => { URL.revokeObjectURL(blobUrl); iframe.remove(); reject(new Error("iframe 로드 실패")); };
            document.body.appendChild(iframe);
          });
          images.push(dataUrl);
        }
        log(`브라우저 캡처 완료: ${images.length}장`);
      }

      if (images.length === 0) {
        throw new Error("게시할 이미지가 없습니다. 카드를 먼저 조립해주세요.");
      }

      log(`instagram-post API 호출 (이미지 ${images.length}장)`);
      const res = await fetch("/api/instagram-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: igConfig.accountId,
          accessToken: igConfig.accessToken,
          images,
          caption: postCaption || topic,
        }),
      });
      const data = await res.json();
      log(`instagram-post 응답: ${res.status} / ${JSON.stringify(data).slice(0, 120)}`);
      if (!res.ok) throw new Error(data.error || "게시 실패");
      log(`게시 완료! permalink: ${data.permalink}`);
      setIgResult({ ok: true, permalink: data.permalink });
    } catch (e) {
      log(`오류: ${e.message}`);
      setError(e.message);
    } finally {
      setIgPosting(false);
    }
  };

  // ── 스텝 인디케이터 ──
  const STEP_KEYS = ["setup", "research", "planning", "images", "assembly", "deploy"];
  function StepBar() {
    const cur = STEP_KEYS.indexOf(step);
    return (
      <div className="flex items-center">
        {STEP_LABELS.map((label, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div
              className={`flex flex-col items-center gap-1 flex-shrink-0 transition-opacity ${i <= cur ? "opacity-100" : "opacity-30"}`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-all
                ${i < cur ? "bg-violet-500 border-violet-500 text-white" : i === cur ? "border-violet-500 text-violet-600 bg-violet-50" : "border-gray-300 text-gray-400 bg-white"}`}
              >
                {i < cur ? "✓" : i + 1}
              </div>
              <span
                className={`text-[9px] font-medium whitespace-nowrap hidden sm:block ${i === cur ? "text-violet-600" : "text-gray-400"}`}
              >
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 mb-5 sm:mb-3 transition-colors ${i < cur ? "bg-violet-400" : "bg-gray-200"}`}
              />
            )}
          </div>
        ))}
      </div>
    );
  }

  // ── 공통: 사용자 상태바 ──
  function UserBar() {
    return (
      <div className="flex items-center justify-between px-4 py-2 bg-violet-50 border border-violet-100 rounded-xl mb-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-[10px] font-bold">
            {session.displayName.charAt(0)}
          </div>
          <span className="text-xs font-semibold text-violet-700">{session.displayName}</span>
        </div>
        <button
          onClick={handleLogout}
          aria-label="로그아웃"
          className="px-2 py-1 text-[10px] text-gray-500 border border-transparent rounded-md hover:text-red-500 hover:bg-red-50 hover:border-red-100 focus:outline-none focus:ring-2 focus:ring-red-200 transition-colors cursor-pointer"
        >
          로그아웃
        </button>
      </div>
    );
  }

  // ══ STEP: setup ══
  if (step === "setup")
    return (
      <div className="p-6 space-y-5">
        <UserBar />
        <StepBar />

        <div className="bg-gradient-to-r from-violet-50 to-pink-50 border border-violet-200 rounded-xl px-4 py-3">
          <p className="text-xs font-bold text-violet-700 mb-0.5">🚀 통합 카드뉴스 파이프라인</p>
          <p className="text-[11px] text-violet-600">
            리서치 → 기획 → 이미지 → 조립 → 배포 — 하나의 흐름으로 완성
          </p>
        </div>

        {/* 주제 */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-gray-700">주제 입력 *</label>
            <button
              onClick={() => setShowTopicPicker(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-violet-200 text-violet-600 bg-violet-50 hover:bg-violet-100 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              인기글에서 가져오기
            </button>
          </div>
          <textarea
            rows={3}
            className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl outline-none focus:border-violet-400 resize-y leading-relaxed"
            placeholder="예: 봄철 피부 관리법, AI 트렌드 2025, 제주도 여행 코스"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
          <p className="text-[11px] text-gray-400 text-right mt-0.5">{topic.length}자</p>
        </div>

        {showTopicPicker && (
          <TopicPicker
            onSelect={v => setTopic(typeof v === "string" ? v : v.text || v.title || "")}
            onClose={() => setShowTopicPicker(false)}
          />
        )}

        {/* 브랜드 기본 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1.5">브랜드명</label>
            <input
              type="text"
              placeholder="브랜드명 (선택)"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-violet-400"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1.5">브랜드 컬러</label>
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex-shrink-0 shadow-sm border border-gray-200"
                style={{ background: `linear-gradient(135deg, ${color1}, ${color2})` }}
              />
              <input
                type="color"
                value={color1}
                onChange={(e) => setColor1(e.target.value)}
                className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200 bg-white p-0.5 flex-shrink-0"
                title="주색상"
              />
              <input
                type="color"
                value={color2}
                onChange={(e) => setColor2(e.target.value)}
                className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200 bg-white p-0.5 flex-shrink-0"
                title="보조색상"
              />
            </div>
          </div>
        </div>

        {/* 이미지 생성 방식 */}
        <div>
          <label className="text-xs font-bold text-gray-700 block mb-1.5">이미지 방식</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setUseTemplate(true)}
              className={`relative flex flex-col gap-1 p-3 rounded-xl border-2 text-left transition-all
                ${useTemplate ? "border-violet-400 bg-violet-50" : "border-gray-200 bg-white hover:border-gray-300"}`}
            >
              {useTemplate && (
                <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-violet-500 text-white">선택됨</span>
              )}
              <span className="text-sm font-bold text-violet-700">✨ 프리미엄 템플릿</span>
              <span className="text-[10px] text-gray-500 leading-relaxed">커버·본문·CTA<br/>인스타 전용 디자인</span>
            </button>
            <button
              onClick={() => setUseTemplate(false)}
              className={`relative flex flex-col gap-1 p-3 rounded-xl border-2 text-left transition-all
                ${!useTemplate ? "border-pink-400 bg-pink-50" : "border-gray-200 bg-white hover:border-gray-300"}`}
            >
              {!useTemplate && (
                <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-pink-500 text-white">선택됨</span>
              )}
              <span className="text-sm font-bold text-pink-700">🖼 AI 이미지 생성</span>
              <span className="text-[10px] text-gray-500 leading-relaxed">이미지 API로<br/>슬라이드별 생성</span>
            </button>
          </div>
        </div>

        {/* 폰트 (AI 이미지 모드만) */}
        {!useTemplate && (
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1.5">폰트</label>
            <div className="flex gap-2">
              {FONTS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFont(f)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${font === f ? "border-violet-400 bg-violet-50 text-violet-700 font-semibold" : "border-gray-200 text-gray-600 hover:border-gray-300 bg-white"}`}
                  style={{ fontFamily: FONT_CSS[f] }}
                >
                  {FONT_LABELS[f]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 톤 */}
        <div>
          <label className="text-xs font-bold text-gray-700 block mb-1.5">톤 / 분위기</label>
          <div className="flex flex-wrap gap-2">
            {TONE_OPTS.map((o) => (
              <button
                key={o.v}
                onClick={() => setTone(o.v)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all
                ${tone === o.v ? "border-violet-400 bg-violet-50 text-violet-700" : "border-gray-200 text-gray-600 hover:border-gray-300 bg-white"}`}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>

        {/* 목적 */}
        <div>
          <label className="text-xs font-bold text-gray-700 block mb-1.5">콘텐츠 목적</label>
          <div className="flex flex-wrap gap-2">
            {PURPOSE_OPTS.map((o) => (
              <button
                key={o.v}
                onClick={() => setPurpose(o.v)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all
                ${purpose === o.v ? "border-violet-400 bg-violet-50 text-violet-700" : "border-gray-200 text-gray-600 hover:border-gray-300 bg-white"}`}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>

        {/* 슬라이드 수 */}
        <div>
          <label className="text-xs font-bold text-gray-700 block mb-1.5">슬라이드 수</label>
          <div className="flex gap-2">
            {[5, 6, 7, 8, 10].map((n) => (
              <button
                key={n}
                onClick={() => setSlideCount(n)}
                className={`w-9 h-9 rounded-xl text-sm font-bold border-2 transition-all
                ${slideCount === n ? "border-violet-400 bg-violet-50 text-violet-700" : "border-gray-200 text-gray-600 bg-white hover:border-gray-300"}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={startResearch}
          disabled={!topic.trim()}
          className="w-full py-3.5 bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          리서치 시작
        </button>
      </div>
    );

  // ══ STEP: research ══
  if (step === "research")
    return (
      <div className="p-6 space-y-4">
        <UserBar />
        <StepBar />
        {running ? (
          <Spinner
            label={`"${topic}" 리서치 중...`}
            sub="네이버 검색 + AI 분석"
            gradient="from-blue-500 to-cyan-600"
          />
        ) : research ? (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs font-bold text-blue-700 mb-2">📋 리서치 보고서</p>
              <div className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto pr-1">
                {research}
              </div>
            </div>
            {error && <ErrorBox msg={error} />}
            <div className="flex gap-2">
              <button
                onClick={startResearch}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-all"
              >
                다시 리서치
              </button>
              <button
                onClick={startPlanning}
                className="flex-[2] py-2.5 bg-gradient-to-r from-violet-500 to-pink-500 text-white text-sm font-bold rounded-xl hover:from-violet-600 hover:to-pink-600 transition-all"
              >
                기획 시작 →
              </button>
            </div>
          </>
        ) : (
          error && <ErrorBox msg={error} onRetry={startResearch} />
        )}
      </div>
    );

  // ══ STEP: planning ══
  if (step === "planning")
    return (
      <div className="p-6 space-y-4">
        <UserBar />
        <StepBar />
        {running ? (
          <Spinner label="카드뉴스 기획 중..." gradient="from-purple-500 to-violet-600" />
        ) : plan ? (
          <>
            <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 flex items-center justify-between">
              <p className="text-xs font-bold text-purple-700">
                📋 {plan.type} · {plan.slides?.length}장
              </p>
              <span className="text-[10px] text-purple-500">{topic}</span>
            </div>
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {plan.slides?.map((s, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border text-xs
                  ${s.part === "표지" ? "border-pink-200 bg-pink-50" : s.part === "마무리" ? "border-emerald-200 bg-emerald-50" : "border-gray-200 bg-white"}`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5
                    ${s.part === "표지" ? "bg-pink-200 text-pink-700" : s.part === "마무리" ? "bg-emerald-200 text-emerald-700" : "bg-gray-200 text-gray-600"}`}
                  >
                    {s.num}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-800 truncate">{s.headline}</p>
                    {s.body && <p className="text-gray-500 mt-0.5 line-clamp-1">{s.body}</p>}
                    <p className="text-gray-300 mt-0.5 line-clamp-1 italic text-[10px]">
                      {s.imagePrompt}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {error && <ErrorBox msg={error} />}

            {/* 벤치마킹 디자인 첨부 */}
            <div className="border-2 border-dashed border-gray-200 rounded-xl overflow-hidden">
              {benchmarkImg ? (
                <div className="flex items-center gap-3 p-3">
                  <img
                    src={benchmarkImg.dataUrl}
                    alt="벤치마킹"
                    className="w-12 h-[60px] object-cover rounded-lg border border-gray-200 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-violet-700">벤치마킹 디자인 첨부됨</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">이 디자인 스타일로 HTML 카드가 생성됩니다</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBenchmarkImg(null)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors">
                  <input type="file" accept="image/*" onChange={handleBenchmarkFile} className="hidden" />
                  <div className="w-12 h-[60px] rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                      <circle cx="9" cy="9" r="2"/>
                      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-600">벤치마킹 디자인 첨부 <span className="font-normal text-gray-400">(선택)</span></p>
                    <p className="text-[10px] text-gray-400 mt-0.5">카드뉴스 레퍼런스 이미지를 첨부하면 그 디자인 그대로 생성됩니다</p>
                  </div>
                </label>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={startPlanning}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-all"
              >
                다시 기획
              </button>
              {useTemplate && !benchmarkImg ? (
                <button
                  onClick={() => startAssembly([])}
                  className="flex-[2] py-2.5 text-white text-sm font-bold rounded-xl transition-all bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600"
                >
                  ✨ 프리미엄 템플릿으로 조립 →
                </button>
              ) : (
                <button
                  onClick={() => {
                    setImages([]);
                    benchmarkImg ? startBenchmarkImages() : startImages();
                  }}
                  className={`flex-[2] py-2.5 text-white text-sm font-bold rounded-xl transition-all
                    ${benchmarkImg
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                      : "bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600"
                    }`}
                >
                  {benchmarkImg ? "벤치마킹 디자인으로 생성 →" : "이미지 생성 →"}
                </button>
              )}
            </div>
            {(!useTemplate || benchmarkImg) && (
              <button
                onClick={() => startAssembly([])}
                className="w-full py-2 border border-dashed border-gray-300 text-xs text-gray-400 rounded-xl hover:bg-gray-50 transition-all"
              >
                이미지 건너뛰고 바로 조립
              </button>
            )}
          </>
        ) : (
          error && <ErrorBox msg={error} onRetry={startPlanning} />
        )}
      </div>
    );

  // ══ STEP: images ══
  if (step === "images")
    return (
      <div className="p-6 space-y-4">
        <UserBar />
        <StepBar />

        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-gray-700">
            {running
              ? `이미지 생성 중... ${imgProg.done}/${imgProg.total}`
              : `완료 ${images.filter(Boolean).length}/${plan.slides.length}장`}
          </p>
          {running && (
            <div className="w-28 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full transition-all"
                style={{ width: `${(imgProg.done / imgProg.total) * 100}%` }}
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {plan.slides.map((s, i) => {
            const isDone = i < imgProg.done;
            const isCurrent =
              running && !isDone && i >= imgProg.done && i < imgProg.done + BATCH_SIZE;
            return (
              <div
                key={i}
                className="relative rounded-lg overflow-hidden bg-gray-100 border border-gray-200"
                style={{ aspectRatio: "4/5" }}
              >
                {images[i] ? (
                  <img src={images[i]} alt={s.headline} className="w-full h-full object-cover" />
                ) : (
                  <div
                    className={`w-full h-full flex flex-col items-center justify-center gap-1 transition-colors
                    ${isCurrent ? "bg-violet-50 animate-pulse" : isDone && !images[i] ? "bg-red-50" : "bg-gray-50"}`}
                  >
                    {isCurrent ? (
                      <svg
                        className="animate-spin text-violet-400"
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                    ) : isDone && !images[i] ? (
                      <span className="text-[10px] text-red-400 text-center px-1">생성 실패</span>
                    ) : (
                      <span className="text-xs text-gray-300 font-bold">{s.num}</span>
                    )}
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1.5 py-1">
                  <p className="text-[9px] text-white truncate">{s.headline}</p>
                </div>
              </div>
            );
          })}
        </div>

        {error && <ErrorBox msg={error} />}

        {!running && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setImages([]);
                  startImages();
                }}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-all"
              >
                다시 생성
              </button>
              <button
                onClick={() => startAssembly(images)}
                className="flex-[2] py-2.5 bg-gradient-to-r from-violet-500 to-pink-500 text-white text-sm font-bold rounded-xl hover:from-violet-600 hover:to-pink-600 transition-all"
              >
                카드 조립 →
              </button>
            </div>
            <button
              onClick={() => { setImages([]); setStep("planning"); }}
              className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
              기획 단계로 돌아가기
            </button>
          </div>
        )}
      </div>
    );

  // ══ STEP: assembly ══
  if (step === "assembly")
    return (
      <div className="p-6 space-y-4">
        <UserBar />
        <StepBar />

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-gray-800">카드 편집</p>
            <p className="text-xs text-gray-400">
              {cards.length}장 · 텍스트를 직접 수정할 수 있습니다
            </p>
          </div>
          <div
            className="w-6 h-6 rounded-md flex-shrink-0 border border-gray-200"
            style={{ background: `linear-gradient(135deg, ${color1}, ${color2})` }}
          />
        </div>

        {/* 카드 편집 목록 */}
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {cards.map((card, i) => (
            <div
              key={i}
              className={`rounded-xl border p-3 space-y-2 text-xs
              ${card.part === "표지" ? "border-pink-200 bg-pink-50" : card.part === "마무리" ? "border-emerald-200 bg-emerald-50" : "border-gray-200 bg-white"}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0
                  ${card.part === "표지" ? "bg-pink-200 text-pink-700" : card.part === "마무리" ? "bg-emerald-200 text-emerald-700" : "bg-gray-200 text-gray-600"}`}
                >
                  {card.num}
                </span>
                <span className="text-gray-400 font-medium">{card.part}</span>
                {card.imageUrl && (
                  <img
                    src={card.imageUrl}
                    alt=""
                    className="w-8 h-8 rounded object-cover ml-auto flex-shrink-0"
                  />
                )}
              </div>
              <input
                type="text"
                value={card.headline}
                onChange={(e) => updateCard(i, "headline", e.target.value)}
                placeholder="제목"
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-violet-400 bg-white"
              />
              <input
                type="text"
                value={card.body}
                onChange={(e) => updateCard(i, "body", e.target.value)}
                placeholder="본문 (선택)"
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:border-violet-400 bg-white"
              />
            </div>
          ))}
        </div>

        {/* 미리보기 슬라이더 */}
        {(cardHtmls.length > 0 || htmlContent) && (() => {
          const total = cardHtmls.length || cards.length;
          const safeIdx = Math.min(previewIdx, total - 1);
          const SCALE = 0.28;
          const W = Math.round(1080 * SCALE); // 302px
          const H = Math.round(1350 * SCALE); // 378px
          const currentHtml = cardHtmls[safeIdx] || htmlContent;
          return (
            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              {/* 상단 바 */}
              <div className="px-3 py-2 bg-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  </div>
                  <p className="text-[11px] text-gray-400 ml-1">카드 미리보기</p>
                </div>
                <p className="text-[11px] text-gray-400 font-semibold">
                  {safeIdx + 1} / {total}
                </p>
              </div>

              {/* 카드 뷰 + 좌우 버튼 */}
              <div className="bg-gray-900 flex items-center gap-0" style={{ height: `${H + 24}px` }}>
                {/* 이전 버튼 */}
                <button
                  onClick={() => setPreviewIdx((p) => Math.max(0, p - 1))}
                  disabled={safeIdx === 0}
                  className="flex-shrink-0 w-9 h-full flex items-center justify-center text-gray-500 hover:text-white disabled:opacity-20 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 18l-6-6 6-6"/>
                  </svg>
                </button>

                {/* iframe 카드 */}
                <div
                  className="flex-1 flex items-center justify-center"
                  style={{ height: `${H + 24}px` }}
                >
                  <div
                    style={{
                      width: `${W}px`,
                      height: `${H}px`,
                      overflow: "hidden",
                      borderRadius: "6px",
                      flexShrink: 0,
                      boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                      position: "relative",
                    }}
                  >
                    <iframe
                      key={`${safeIdx}-${currentHtml.slice(0, 40)}`}
                      srcDoc={currentHtml}
                      style={{
                        border: "none",
                        width: "1080px",
                        height: "1350px",
                        display: "block",
                        transformOrigin: "top left",
                        transform: `scale(${SCALE})`,
                        pointerEvents: "none",
                      }}
                      title={`카드 ${safeIdx + 1}`}
                      sandbox="allow-same-origin"
                    />
                  </div>
                </div>

                {/* 다음 버튼 */}
                <button
                  onClick={() => setPreviewIdx((p) => Math.min(total - 1, p + 1))}
                  disabled={safeIdx === total - 1}
                  className="flex-shrink-0 w-9 h-full flex items-center justify-center text-gray-500 hover:text-white disabled:opacity-20 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </button>
              </div>

              {/* 하단: 도트 네비게이션 + 카드 다운로드 */}
              <div className="bg-gray-900 pb-3 flex flex-col items-center gap-2">
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: total }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPreviewIdx(i)}
                      className={`rounded-full transition-all ${
                        i === safeIdx
                          ? "w-4 h-1.5 bg-violet-400"
                          : "w-1.5 h-1.5 bg-gray-600 hover:bg-gray-400"
                      }`}
                    />
                  ))}
                </div>
                <button
                  onClick={() => {
                    const html = cardHtmls[safeIdx] || htmlContent;
                    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${topic.slice(0, 15)}-카드${safeIdx + 1}.html`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-[11px] font-semibold transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  카드 {safeIdx + 1} 다운로드
                </button>
              </div>
            </div>
          );
        })()}

        {error && <ErrorBox msg={error} />}

        <div className="flex gap-2">
          <button
            onClick={() => setStep("images")}
            className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-all"
          >
            ← 이미지 재생성
          </button>
          <button
            onClick={() => setStep("deploy")}
            className="flex-[2] py-2.5 bg-gradient-to-r from-violet-500 to-pink-500 text-white text-sm font-bold rounded-xl hover:from-violet-600 hover:to-pink-600 transition-all"
          >
            배포 →
          </button>
        </div>
      </div>
    );

  // ══ STEP: deploy ══
  if (step === "deploy")
    return (
      <div className="p-6 space-y-5">
        <UserBar />
        <StepBar />

        {/* 상단: 제목 */}
        <div>
          <p className="text-sm font-bold text-gray-800">배포</p>
          <p className="text-xs text-gray-400">{cards.length}장 · {topic}</p>
        </div>

        {/* 인스타그램 설정 */}
        <div className="space-y-3 bg-gray-50 border border-gray-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-pink-500">
              <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
            </svg>
            <p className="text-xs font-bold text-gray-700">인스타그램 자동 게시</p>
            {igConfig.accessToken && igConfig.accountId
              ? <span className="ml-auto text-[10px] font-bold bg-green-100 text-green-600 border border-green-200 rounded-full px-2 py-0.5">연동됨 · @{igConfig.username || igConfig.accountId}</span>
              : <span className="ml-auto text-[10px] text-gray-400">미연동</span>
            }
          </div>

          {/* OAuth 연동 버튼 */}
          {igConfig.accessToken && igConfig.accountId ? (
            <div className="flex items-center justify-between bg-green-50 border border-green-100 rounded-xl px-3 py-2.5">
              <p className="text-xs text-green-700">Instagram 계정이 연동되었습니다.</p>
              <button
                type="button"
                onClick={() => {
                  const cleared = { accessToken: "", accountId: "", username: "" };
                  setIgConfig(cleared);
                  saveSocial(igKey, session.username, cleared);
                }}
                className="text-[10px] text-red-400 hover:text-red-600 font-semibold"
              >
                연동 해제
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                const SCOPES = "instagram_business_basic,instagram_business_content_publish";
                const oauthUrl = `https://www.instagram.com/oauth/authorize?force_reauth=true&client_id=1657867098880562&redirect_uri=https://planforge-ui.vercel.app/auth/instagram/&scope=${SCOPES}&response_type=code&enable_fb_login=0&hide_fb_login=1`;
                const popup = window.open(oauthUrl, "instagram-auth", "width=580,height=720,left=200,top=100");
                const onMessage = (e) => {
                  if (e.data?.type !== "instagram_auth") return;
                  window.removeEventListener("message", onMessage);
                  if (e.data.error) { setError("Instagram 연동 실패: " + e.data.error); return; }
                  const next = { accessToken: e.data.accessToken, accountId: e.data.userId, username: e.data.username || "" };
                  setIgConfig(next);
                  saveSocial(igKey, session.username, next);
                };
                window.addEventListener("message", onMessage);
                const timer = setInterval(() => { if (popup?.closed) { clearInterval(timer); window.removeEventListener("message", onMessage); } }, 500);
              }}
              className="w-full py-2.5 bg-gradient-to-r from-pink-500 to-fuchsia-500 hover:from-pink-600 hover:to-fuchsia-600 text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
              </svg>
              Instagram 계정 연동하기
            </button>
          )}

          {/* 캡션 */}
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1.5">
              게시 캡션 <span className="font-normal text-gray-400">(선택 — 비우면 주제 사용)</span>
            </label>
            <div className="flex flex-col gap-2">
              <div className="flex flex-col md:flex-row md:items-stretch gap-2">
                <button
                  type="button"
                  onClick={generateCaptionFromPrompt}
                  disabled={captionGenerating || !topic?.trim()}
                  className="px-3 py-2 rounded-lg text-[11px] font-bold border border-pink-200 text-pink-600 bg-pink-50 hover:bg-pink-100 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {captionGenerating ? "캡션 생성 중..." : "기획 기반 캡션 작성"}
                </button>
                <textarea
                  rows={2}
                  placeholder={`캡션 생성 프롬프트 예시:\n{topic} 중심으로 3문장 + CTA + 해시태그 5개`}
                  className="flex-1 w-full px-3 py-2 text-[11px] border border-gray-200 rounded-lg outline-none focus:border-violet-400 bg-white resize-none leading-relaxed"
                  value={captionPrompt}
                  onChange={(e) => setCaptionPrompt(e.target.value)}
                />
                <button
                  type="button"
                  onClick={persistCaptionPrompt}
                  disabled={captionSaving}
                  className="px-3 py-2 rounded-lg text-[11px] font-bold border border-gray-200 text-gray-700 bg-gray-50 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {captionSaving ? "저장 중..." : "저장"}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                <code className="text-gray-500">{'{topic}'}</code>,{" "}
                <code className="text-gray-500">{'{brand}'}</code>,{" "}
                <code className="text-gray-500">{'{tone}'}</code>,{" "}
                <code className="text-gray-500">{'{purpose}'}</code>,{" "}
                <code className="text-gray-500">{'{research}'}</code>,{" "}
                <code className="text-gray-500">{'{cards}'}</code> 를 사용할 수 있습니다.
              </p>
            </div>
            <textarea
              rows={3}
              placeholder={`예: ${topic}\n\n#카드뉴스 #정보 #트렌드`}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-violet-400 bg-white resize-none leading-relaxed"
              value={postCaption}
              onChange={(e) => setPostCaption(e.target.value)}
            />
          </div>


          <p className="text-[11px] text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 leading-relaxed">
            🔒 API 정보는 사용자별로 브라우저 로컬에 저장됩니다. 이미지는 서버에 임시 업로드 후 즉시 삭제됩니다.
          </p>

          {/* 게시 버튼 */}
          <button
            onClick={postToInstagram}
            disabled={igPosting || !igConfig.accountId || !igConfig.accessToken}
            className="w-full py-3 bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:from-fuchsia-600 hover:to-pink-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {igPosting ? (
              <>
                <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                게시 중...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
                인스타그램에 게시하기
              </>
            )}
          </button>

          {igResult?.ok && (
            <div className="px-3 py-2.5 rounded-xl text-xs font-medium bg-green-50 border border-green-200 text-green-700 flex items-start gap-2">
              <span>✅</span>
              <div>
                <span>게시 완료!</span>
                {igResult.permalink && (
                  <a href={igResult.permalink} target="_blank" rel="noopener noreferrer" className="block mt-1 underline">
                    게시물 보기
                  </a>
                )}
              </div>
            </div>
          )}

          {/* 실행 로그 패널 */}
          {igLogs.length > 0 && (
            <div className="rounded-xl border border-gray-800 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-gray-900">
                <span className="text-[11px] font-bold text-gray-300 font-mono">실행 로그</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(igLogs.join("\n"));
                    }}
                    className="text-[10px] text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 px-2 py-0.5 rounded transition-colors"
                  >
                    복사
                  </button>
                  <button
                    onClick={() => setIgLogs([])}
                    className="text-[10px] text-gray-500 hover:text-gray-300"
                  >
                    지우기
                  </button>
                </div>
              </div>
              <div className="bg-gray-950 p-3 max-h-48 overflow-y-auto space-y-0.5 font-mono">
                {igLogs.map((line, i) => (
                  <div key={i} className={`text-[11px] leading-relaxed ${line.includes("오류") ? "text-red-400" : "text-gray-300"}`}>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Threads ── */}
        <div className="space-y-3 bg-gray-50 border border-gray-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 rounded bg-gray-900 flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4"/>
                <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>
              </svg>
            </div>
            <p className="text-xs font-bold text-gray-700">스레드 (Threads)</p>
            <span className="text-[10px] text-gray-500 font-semibold bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5">
              {session.displayName} 계정
            </span>
            {thConfig.userId && thConfig.accessToken && (
              <span className="ml-auto text-[10px] font-bold bg-green-100 text-green-600 border border-green-200 rounded-full px-2 py-0.5">연동됨</span>
            )}
          </div>

          {thConfig.userId && thConfig.accessToken ? (
            <>
              <p className="text-xs text-gray-500">
                연동된 계정으로 게시합니다. 변경은 관리자 → 소셜 계정 연동에서.
              </p>
              <button
                onClick={postToThreads}
                disabled={thPosting}
                className="w-full py-2.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {thPosting ? (
                  <>
                    <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    스레드에 게시 중...
                  </>
                ) : "스레드에 게시하기"}
              </button>
              {thResult && (
                <div className="px-3 py-2 rounded-xl text-xs font-medium bg-green-50 border border-green-200 text-green-700 flex items-start gap-2">
                  <span>✅</span>
                  <div>
                    <span>{thResult.message}</span>
                    {thResult.permalink && (
                      <a href={thResult.permalink} target="_blank" rel="noopener noreferrer" className="block mt-1 underline">게시물 보기</a>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-400 bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2">
              관리자 → 소셜 계정 연동에서 스레드 API를 먼저 설정해주세요.
            </p>
          )}
        </div>

        {error && <ErrorBox msg={error} />}

        <div className="flex gap-2">
          <button
            onClick={() => setStep("assembly")}
            className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-all"
          >
            ← 카드 편집
          </button>
          <button
            onClick={reset}
            className="flex-1 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-700 transition-all"
          >
            새 콘텐츠 만들기
          </button>
        </div>
      </div>
    );

  return null;
}
