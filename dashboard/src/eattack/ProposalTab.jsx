/**
 * 제안서 자동화 탭
 * 흐름: URL 입력 → 고객사 분석 → 보고서 편집 → 제안서 생성 → PPT 다운로드
 */
import { useState, useRef } from "react";
import { callGemini } from "../utils/gemini";
import EdenServiceSelector from "./EdenServiceSelector";
import PptTemplateManager from "./PptTemplateManager";

// ── 상수 ──
const LS_KEY = "eden_proposal_v1";

const SYSTEM_PROMPT = `
당신은 10년차 콘텐츠 마케터이자 퍼포먼스 마케터입니다.
브랜드 포지셔닝, 고객 심리, 디지털 광고, SNS 마케팅, 전환율 최적화에 깊은 전문성을 보유하고 있습니다.
클라이언트의 비즈니스를 빠르게 파악하고, 데이터 기반으로 마케팅 기회를 도출하는 것이 강점입니다.
반드시 한국어로 답변하세요.
`.trim();

const PROPOSAL_SYSTEM_PROMPT = `
당신은 대면 PT(프레젠테이션) 제안서를 제작하는 10년차 마케팅 제안 전문가입니다.
에덴은 콘텐츠 마케팅, SNS 운영, 퍼포먼스 마케팅을 제공하는 마케팅 대행사입니다.

## 출력 형식 — PPT 슬라이드 단위 (필수)
각 슬라이드는 아래 형식으로 작성:

---SLIDE---
### [슬라이드 N] Action Title (인사이트 중심 제목)
- 핵심 메시지 1 (한 줄, 짧고 강하게)
- 핵심 메시지 2
- 핵심 메시지 3 (최대 5개)

📌 핵심 수치/강조: (있으면 작성)
💬 발표 멘트: "실제 발표할 때 말할 한두 문장"
---END_SLIDE---

- 글로 풀어 쓰지 말 것. 슬라이드 불릿은 짧게 (10~20자 이내)
- 긴 문단 금지 — PPT에 들어가는 텍스트만 작성

## Impact-8 Framework
HOOK→SUMMARY→INSIGHT→CONCEPT→ACTION PLAN→MANAGEMENT→WHY US→INVESTMENT 순서

## Action Title 규칙 (필수)
- ❌ "시장 환경 분석" (What)
- ✅ "MZ세대 55%가 SNS 보고 구매 결정" (Why/So-What + 숫자)

## C-E-I 설득 구조
- Claim: 슬라이드 제목에 핵심 주장
- Evidence: 불릿에 수치/사례
- Impact: 발표 멘트에 고객사 관점 가치

## KPI
산출 근거 포함: 팔로워 +30% = 인플루언서(+12%) + 릴스(+10%) + 이벤트(+8%)

## Win Theme
각 섹션 슬라이드 어딘가에 Win Theme을 자연스럽게 강조할 것.

반드시 한국어로 답변하세요.
`.trim();

const PROPOSAL_PHASES = [
  {
    key: "summary",
    title: "SUMMARY",
    subtitle: "Executive Summary + Win Theme 정의",
    slides: 2,
    guide: "슬라이드 1: 한 줄 제안 + Why Us 3가지 / 슬라이드 2: Win Theme 3개 + 핵심 KPI"
  },
  {
    key: "insight",
    title: "INSIGHT",
    subtitle: "시장 환경 & 고객 문제 정의",
    slides: 3,
    guide: "슬라이드 1: 시장 트렌드(숫자 포함) / 슬라이드 2: 고객사 Pain Point / 슬라이드 3: 놓치고 있는 기회"
  },
  {
    key: "concept",
    title: "CONCEPT & STRATEGY",
    subtitle: "핵심 컨셉 & 차별화 전략",
    slides: 2,
    guide: "슬라이드 1: 에덴의 핵심 접근법 / 슬라이드 2: 경쟁사 대비 차별점"
  },
  {
    key: "action",
    title: "ACTION PLAN",
    subtitle: "상세 실행 계획 (핵심)",
    slides: 5,
    guide: "슬라이드 1: 전체 전략 로드맵 / 슬라이드 2-3: 채널별 전략 / 슬라이드 4: 월별 실행 일정 / 슬라이드 5: 콘텐츠 예시/캠페인"
  },
  {
    key: "whyus",
    title: "WHY US",
    subtitle: "에덴 수행 역량 & 실적",
    slides: 2,
    guide: "슬라이드 1: 유사 실적 + 수치 / 슬라이드 2: 팀 역량 + 차별화 강점"
  },
  {
    key: "investment",
    title: "INVESTMENT & ROI",
    subtitle: "투자 비용 & 기대효과",
    slides: 2,
    guide: "슬라이드 1: 비용 구조 + 서비스 패키지 / 슬라이드 2: KPI(산출근거 포함) + Next Step"
  },
];

// ── 로컬스토리지 ──
function saveDraft(data) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
}
function loadDraft() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch { return null; }
}

// ── 파싱 유틸 ──

// JSON 블록 파싱 (Win Themes 추출)
function parseAnalysisJson(raw) {
  const match = raw.match(/---JSON_ANALYSIS_START---([\s\S]*?)---JSON_ANALYSIS_END---/);
  if (!match) return null;
  try { return JSON.parse(match[1].trim()); } catch { return null; }
}

// 마크다운 섹션만 추출 (JSON 블록 제거)
function stripJsonBlock(raw) {
  return raw.replace(/---JSON_ANALYSIS_START---[\s\S]*?---JSON_ANALYSIS_END---/, '').trim();
}

// 섹션 파싱: ## 헤더 기준으로 분리
function parseSections(text) {
  const lines = text.split("\n");
  const sections = [];
  let current = null;
  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (current) sections.push(current);
      current = { title: line.replace("## ", "").trim(), content: "" };
    } else if (current) {
      current.content += (current.content ? "\n" : "") + line;
    }
  }
  if (current) sections.push(current);
  if (sections.length === 0) {
    sections.push({ title: "분석 결과", content: text });
  }
  return sections.map(s => ({ ...s, content: s.content.trim() }));
}

// ---SLIDE--- 블록 파싱 → PptxGenJS용 슬라이드 배열
function parseSlidesFromProposal(text) {
  const allSlides = [];

  // Phase 블록 단위로 분리 (--- 구분선 기준)
  const phaseBlocks = text.split(/\n---\n/);

  for (const block of phaseBlocks) {
    // Phase 제목/부제목 추출
    const phaseTitleMatch = block.match(/^# (.+)/m);
    const phaseSubtitleMatch = block.match(/^> (.+)/m);

    if (phaseTitleMatch) {
      allSlides.push({
        type: 'section',
        title: phaseTitleMatch[1].trim(),
        subtitle: phaseSubtitleMatch ? phaseSubtitleMatch[1].trim() : ''
      });
    }

    // SLIDE 블록들 추출
    const slideMatches = [...block.matchAll(/---SLIDE---([\s\S]*?)---END_SLIDE---/g)];
    for (const match of slideMatches) {
      const content = match[1].trim();
      const lines = content.split('\n');

      const titleLine = lines.find(l => l.startsWith('### '));
      const title = titleLine
        ? titleLine.replace(/^### \[슬라이드 \d+\]\s*/, '').trim()
        : '슬라이드';

      const bullets = lines
        .filter(l => l.startsWith('- '))
        .map(l => l.replace(/^- /, '').trim())
        .filter(Boolean);

      const emphasisLine = lines.find(l => l.startsWith('📌'));
      const emphasis = emphasisLine
        ? emphasisLine.replace(/^📌\s*핵심 수치\/강조:\s*/, '').trim()
        : '';

      const noteLine = lines.find(l => l.startsWith('💬'));
      const note = noteLine
        ? noteLine.replace(/^💬\s*발표 멘트:\s*[""]?/, '').replace(/[""]$/, '').trim()
        : '';

      allSlides.push({ type: 'content', title, bullets, emphasis, note });
    }
  }

  return allSlides;
}

// Phase별 프롬프트 빌더
function buildPhasePrompt(phase, reportText, winThemes, painPoints, clientInfo, edenServices) {
  const winThemeText = winThemes.length > 0
    ? winThemes.map((wt, i) => `  ${i + 1}. **${wt.name}**: ${wt.description}`).join('\n')
    : '(분석에서 추출된 Win Theme 없음)';
  const painPointText = painPoints.length > 0
    ? painPoints.map(p => `  - ${p}`).join('\n')
    : '(분석에서 추출된 Pain Point 없음)';

  return `
## Phase: ${phase.title} (${phase.subtitle})
슬라이드 수: ${phase.slides}장

## 고객사 분석 보고서
${reportText}

## Win Theme (반드시 이 메시지와 일관성 유지)
${winThemeText}

## 고객사 핵심 Pain Point
${painPointText}

## 에덴 서비스
${edenServices}

## 고객사
${clientInfo.title} (${clientInfo.domain})

---

위 정보를 바탕으로 **${phase.title}** 섹션의 PPT 슬라이드를 **${phase.slides}장** 작성해 주세요.
각 슬라이드 가이드: ${phase.guide}

### 필수 출력 형식 (반드시 준수)
각 슬라이드는 아래 형식으로 작성:

---SLIDE---
### [슬라이드 N] Action Title
- 핵심 메시지 (짧게, 10~20자)
- 핵심 메시지
- 핵심 메시지 (최대 5개)

📌 핵심 수치/강조: (있으면 작성)
💬 발표 멘트: "실제 발표할 한두 문장"
---END_SLIDE---

### 콘텐츠 규칙
1. **Action Title**: 결론/인사이트 중심, 숫자 포함 ("현황 분석" ❌ → "SNS 이용자 55%가 구매 결정에 영향" ✅)
2. **불릿은 짧게**: 문장 금지, 키워드 구 형태로 (긴 설명은 발표 멘트로)
3. **숫자 필수**: "성과 향상" ❌ → "전환율 +35%" ✅
4. **Win Theme 반복**: 이 섹션 슬라이드 중 하나에 자연스럽게 Win Theme 강조
5. 긴 문단, 산문체 절대 금지
`.trim();
}

// ── HTML 슬라이드 생성 ──

function escHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildCoverSlideHtml(clientInfo, winThemes) {
  const subtitle = winThemes.length > 0 ? winThemes[0].description : '마케팅 성장을 위한 맞춤형 전략';
  const dateStr = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
  return `<div class="slide slide-cover">
  <div class="deco-c deco-c1"></div><div class="deco-c deco-c2"></div>
  <div class="cover-inner">
    <div class="brand-tag">EDEN MARKETING · AGENCY PROPOSAL</div>
    <div class="accent-line"></div>
    <h1 class="cover-company">${escHtml(clientInfo.title || clientInfo.domain)}</h1>
    <h2 class="cover-doctype">마케팅 서비스 제안서</h2>
    <p class="cover-subtitle">${escHtml(subtitle)}</p>
    <div class="cover-meta">
      <div class="meta-item"><i class="fas fa-bullseye"></i> ${escHtml(clientInfo.domain)}</div>
      <div class="meta-item"><i class="far fa-calendar-alt"></i> ${dateStr}</div>
      <div class="meta-item"><i class="fas fa-building"></i> 에덴 마케팅</div>
    </div>
  </div>
</div>`;
}

function buildSectionSlideHtml(slide, pg, total) {
  return `<div class="slide slide-section">
  <p class="section-eyebrow">EDEN MARKETING</p>
  <div class="section-line"></div>
  <h1 class="section-title">${escHtml(slide.title)}</h1>
  ${slide.subtitle ? `<p class="section-subtitle">${escHtml(slide.subtitle)}</p>` : ''}
  <div class="slide-pg light">${pg} / ${total}</div>
</div>`;
}

function buildContentSlideHtml(slide, pg, total) {
  const bullets = slide.bullets.slice(0, 5);
  const bulletsHtml = bullets.map(b => `
    <div class="bullet-item">
      <div class="bullet-dot"></div>
      <div class="bullet-text">${escHtml(b)}</div>
    </div>`).join('');
  const emphasisHtml = slide.emphasis ? `
  <div class="emphasis-box">
    <span>📌</span>
    <span class="emphasis-text">${escHtml(slide.emphasis)}</span>
  </div>` : '';
  return `<div class="slide slide-content">
  <div class="content-header">
    <div class="content-title">${escHtml(slide.title)}</div>
  </div>
  <div class="content-body">${bulletsHtml}</div>
  ${emphasisHtml}
  <div class="slide-footer">
    <span class="footer-brand">EDEN MARKETING</span>
    <span class="footer-pg">${pg} / ${total}</span>
  </div>
</div>`;
}

function buildHtmlDocument(parsedSlides, clientInfo, winThemes) {
  const total = 1 + parsedSlides.length;
  const slideHtmls = [buildCoverSlideHtml(clientInfo, winThemes)];
  parsedSlides.forEach((slide, i) => {
    const pg = i + 2;
    if (slide.type === 'section') slideHtmls.push(buildSectionSlideHtml(slide, pg, total));
    else slideHtmls.push(buildContentSlideHtml(slide, pg, total));
  });

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${escHtml(clientInfo.title || clientInfo.domain)} 마케팅 제안서</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap" rel="stylesheet">
<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Noto Sans KR',sans-serif;background:#1E293B;display:flex;flex-direction:column;align-items:center;min-height:100vh;padding:32px 32px 80px}
.sw{display:none}.sw.active{display:block}
/* ── Slide base ── */
.slide{width:1280px;height:720px;position:relative;overflow:hidden;border-radius:8px;box-shadow:0 25px 50px -12px rgba(0,0,0,.5)}
/* ── COVER ── */
.slide-cover{background:#F8FAFC;display:flex;align-items:center;justify-content:center}
.deco-c{position:absolute;border-radius:50%;background:rgba(15,23,42,.03)}
.deco-c1{width:600px;height:600px;top:-200px;right:-100px}
.deco-c2{width:400px;height:400px;bottom:-150px;left:-100px}
.cover-inner{z-index:10;display:flex;flex-direction:column;align-items:center;width:100%;padding:0 100px}
.brand-tag{background:#E2E8F0;color:#475569;padding:8px 20px;border-radius:100px;font-size:13px;font-weight:700;letter-spacing:.06em;margin-bottom:24px;text-transform:uppercase}
.accent-line{width:80px;height:6px;background:#0F172A;margin-bottom:20px}
/* 회사명: 1줄 고정 */
.cover-company{font-size:52px;font-weight:900;color:#0F172A;line-height:1.2;text-align:center;letter-spacing:-.02em;word-break:keep-all;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:1060px;margin-bottom:6px}
/* 문서 유형: 항상 표시 */
.cover-doctype{font-size:32px;font-weight:400;color:#475569;text-align:center;margin-bottom:20px}
/* Win Theme 부제목: 최대 2줄 */
.cover-subtitle{font-size:20px;font-weight:400;color:#64748B;text-align:center;margin-bottom:36px;word-break:keep-all;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-width:900px}
.cover-meta{display:flex;gap:36px;color:#64748B;font-size:15px;font-weight:500;padding-top:20px;border-top:1px solid #E2E8F0}
.meta-item{display:flex;align-items:center;gap:8px}.meta-item i{color:#94A3B8}
/* ── SECTION ── */
.slide-section{background:#0F172A;display:flex;flex-direction:column;align-items:center;justify-content:center}
/* eyebrow: 어두운 배경에 보이는 회색 */
.section-eyebrow{font-size:13px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.15em;margin-bottom:20px}
.section-line{width:60px;height:4px;background:#3B82F6;margin-bottom:28px;border-radius:2px}
.section-title{font-size:56px;font-weight:900;color:white;text-align:center;letter-spacing:-.02em;word-break:keep-all;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-width:1100px}
.section-subtitle{font-size:20px;color:#94A3B8;margin-top:20px;text-align:center;font-weight:400;word-break:keep-all;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-width:900px}
.slide-pg{position:absolute;bottom:16px;right:24px;font-size:13px;font-weight:600;color:#94A3B8}
.slide-pg.light{color:rgba(255,255,255,.3)}
/* ── CONTENT ── */
.slide-content{background:#F8FAFC;display:flex;flex-direction:column}
.content-header{margin:36px 60px 0;padding-left:22px;border-left:6px solid #0F172A;flex-shrink:0}
/* 제목: 최대 2줄 */
.content-title{font-size:30px;font-weight:800;color:#0F172A;line-height:1.3;word-break:keep-all;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
/* 불릿 영역: 남은 공간 차지, 하단 패딩 포함 */
.content-body{flex:1;padding:18px 60px 16px;display:flex;flex-direction:column;gap:9px;overflow:hidden}
.bullet-item{display:flex;align-items:flex-start;gap:14px;background:white;border-radius:12px;padding:12px 20px;border-left:4px solid #0F172A;box-shadow:0 2px 6px rgba(0,0,0,.04);flex-shrink:0}
.bullet-dot{width:7px;height:7px;border-radius:50%;background:#0F172A;margin-top:9px;flex-shrink:0}
/* 불릿 텍스트: 최대 2줄, 넘치면 말줄임 */
.bullet-text{font-size:17px;color:#334155;line-height:1.5;word-break:keep-all;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
/* 강조 박스: 푸터 바로 위 고정 */
.emphasis-box{margin:0 60px 12px;background:white;border:1.5px solid #0F172A;border-radius:12px;padding:12px 20px;display:flex;align-items:center;gap:12px;flex-shrink:0}
/* 강조 텍스트: 최대 2줄 */
.emphasis-text{font-size:14px;font-weight:600;color:#0F172A;word-break:keep-all;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.slide-footer{height:40px;background:#0F172A;display:flex;align-items:center;justify-content:space-between;padding:0 40px;flex-shrink:0}
.footer-brand{font-size:12px;font-weight:700;color:rgba(255,255,255,.4)}
.footer-pg{font-size:12px;color:rgba(255,255,255,.35)}
/* ── NAV ── */
.nav{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:12px;background:rgba(15,23,42,.9);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.1);padding:10px 20px;border-radius:100px;z-index:1000}
.nav button{background:rgba(255,255,255,.1);border:none;color:white;padding:8px 20px;border-radius:8px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;font-size:14px;font-weight:600;transition:background .2s}
.nav button:hover{background:rgba(255,255,255,.25)}
#nc{color:white;font-size:14px;font-weight:500;min-width:80px;text-align:center}
</style>
</head>
<body>
${slideHtmls.map((h, i) => `<div class="sw${i === 0 ? ' active' : ''}" id="sw${i}">${h}</div>`).join('\n')}
<div class="nav">
  <button onclick="go(-1)">← 이전</button>
  <span id="nc">1 / ${total}</span>
  <button onclick="go(1)">다음 →</button>
</div>
<script>
let c=0,t=${total};
function go(d){document.querySelectorAll('.sw').forEach(e=>e.classList.remove('active'));c=(c+d+t)%t;document.getElementById('sw'+c).classList.add('active');document.getElementById('nc').textContent=(c+1)+' / '+t;}
document.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowDown')go(1);if(e.key==='ArrowLeft'||e.key==='ArrowUp')go(-1);});
</script>
</body>
</html>`;
}

// ── 메인 컴포넌트 ──
export default function ProposalTab() {
  // 단계: input | analyzing | report | generating | proposal
  const [step, setStep] = useState("input");

  // Step 1 - 입력값
  const [url, setUrl] = useState("");
  const [edenServices, setEdenServices] = useState("");

  // Step 2 - 분석 상태
  const [analyzeMsg, setAnalyzeMsg] = useState("");
  const [error, setError] = useState("");

  // Step 3 - 보고서
  const [sections, setSections] = useState([]);
  const [clientInfo, setClientInfo] = useState({ domain: "", title: "" });
  const [winThemes, setWinThemes] = useState([]);
  const [painPoints, setPainPoints] = useState([]);

  // Step 4 - 제안서
  const [templateContent, setTemplateContent] = useState("");
  const [templateFileName, setTemplateFileName] = useState("");
  const [proposal, setProposal] = useState("");
  const [proposalEditable, setProposalEditable] = useState("");
  const [phaseProgress, setPhaseProgress] = useState(0);

  // PPT 디자인 템플릿 (PptTemplateManager에서 선택)
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [pptxGenerating, setPptxGenerating] = useState(false);

  const tplInputRef = useRef(null);

  // ── Step 1 → 2: 분석 시작 ──
  async function handleAnalyze() {
    if (!url.trim()) return;
    if (!edenServices.trim()) {
      setError("에덴의 서비스 내용을 입력해 주세요.");
      return;
    }
    setError("");
    setStep("analyzing");
    setAnalyzeMsg("홈페이지 크롤링 중...");

    try {
      const crawlResp = await fetch("/api/crawl-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      if (!crawlResp.ok) {
        const err = await crawlResp.json();
        throw new Error(err.error || "크롤링 실패");
      }
      const crawlData = await crawlResp.json();
      setClientInfo({ domain: crawlData.domain, title: crawlData.meta?.title || crawlData.domain });

      setAnalyzeMsg("Gemini가 분석 중입니다... (10~30초 소요)");

      const prompt = `
다음은 고객사 홈페이지(${crawlData.domain})에서 추출한 정보입니다.

**사이트 제목:** ${crawlData.meta?.title || "없음"}
**메타 설명:** ${crawlData.meta?.desc || crawlData.meta?.ogDesc || "없음"}
**키워드:** ${crawlData.meta?.keywords || "없음"}
**본문 텍스트:**
${crawlData.text}

---

위 정보를 바탕으로 아래 형식에 맞춰 **마케팅 분석 보고서**를 작성해 주세요.
각 섹션은 ## 으로 시작하는 헤더를 사용해 주세요.

## 고객사 개요
(회사 성격, 업종, 주요 제품/서비스 요약)

## 핵심 소구점 분석
(이 브랜드가 가진 강점, 차별화 포인트, 고객에게 전달하는 가치)

## 타겟층 및 고객 니즈
(주요 타겟 고객층, 그들의 니즈·페인포인트, 구매 동기)

## 현재 마케팅 현황 및 기회
(현재 마케팅 방향성 파악, 개선 가능한 마케팅 기회와 갭)

## 에덴 서비스 연결 전략
(에덴이 제공하는 서비스: ${edenServices}
→ 이 서비스가 고객사에 어떻게 도움이 될 수 있는지, 구체적인 연결 포인트 제시)

각 섹션은 핵심 내용을 bullet point와 분석 문장으로 구체적이고 풍부하게 작성해 주세요.

---JSON_ANALYSIS_START---
{
  "win_themes": [
    {"name": "...", "description": "...", "evidence": "..."},
    {"name": "...", "description": "...", "evidence": "..."},
    {"name": "...", "description": "...", "evidence": "..."}
  ],
  "pain_points": ["...", "...", "..."],
  "one_sentence": "고객사를 한 줄로 요약한 문장"
}
---JSON_ANALYSIS_END---
`.trim();

      const raw = await callGemini([{ role: "user", content: prompt }], SYSTEM_PROMPT);

      const structuredData = parseAnalysisJson(raw);
      const cleanRaw = stripJsonBlock(raw);
      const parsed = parseSections(cleanRaw);

      setSections(parsed);
      if (structuredData) {
        setWinThemes(structuredData.win_themes || []);
        setPainPoints(structuredData.pain_points || []);
      }

      saveDraft({ url: url.trim(), edenServices, sections: parsed, clientInfo: { domain: crawlData.domain, title: crawlData.meta?.title || crawlData.domain } });
      setStep("report");

    } catch (e) {
      setError(e.message);
      setStep("input");
    }
  }

  // ── PPT 다운로드 ──
  async function handleDownloadPptx() {
    setPptxGenerating(true);
    try {
      const { default: PptxGenJS } = await import('pptxgenjs');
      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_16x9';

      // 선택된 템플릿 색상 적용 (없으면 에덴 기본 보라 계열)
      const tpl = selectedTemplate;
      const primary = (tpl?.primaryColor || '#4F46E5').replace('#', '');
      const accent = (tpl?.accentColor || '#7C3AED').replace('#', '');
      const bg = (tpl?.backgroundColor || '#FFFFFF').replace('#', '');
      const titleTextColor = tpl?.titleColor ? tpl.titleColor.replace('#', '') : 'FFFFFF';

      // ─ 표지 슬라이드 ─
      const cover = pptx.addSlide();
      cover.background = { color: primary };
      cover.addText(clientInfo.title || clientInfo.domain, {
        x: 0.5, y: 1.0, w: 9, h: 1.2,
        fontSize: 34, bold: true, color: 'FFFFFF', align: 'center'
      });
      cover.addText('마케팅 서비스 제안서', {
        x: 0.5, y: 2.4, w: 9, h: 0.8,
        fontSize: 22, color: 'FFFFFF', align: 'center'
      });
      if (tpl?.styleDescription && tpl.type !== 'default') {
        cover.addText(tpl.styleDescription, {
          x: 0.5, y: 3.4, w: 9, h: 0.5,
          fontSize: 13, color: 'FFFFFF', align: 'center', italic: true
        });
      }
      cover.addText('에덴 마케팅', {
        x: 0.5, y: 4.7, w: 9, h: 0.4,
        fontSize: 13, color: 'FFFFFF', align: 'center'
      });

      // ─ 슬라이드 파싱 ─
      const slides = parseSlidesFromProposal(proposalEditable);

      for (const slide of slides) {
        const s = pptx.addSlide();
        s.background = { color: bg };

        if (slide.type === 'section') {
          // 섹션 구분 슬라이드
          s.background = { color: primary };
          s.addText(slide.title, {
            x: 0.5, y: 1.6, w: 9, h: 1.0,
            fontSize: 36, bold: true, color: 'FFFFFF', align: 'center'
          });
          if (slide.subtitle) {
            s.addText(slide.subtitle, {
              x: 0.5, y: 2.8, w: 9, h: 0.6,
              fontSize: 18, color: 'FFFFFF', align: 'center'
            });
          }
        } else {
          // 내용 슬라이드

          // 상단 타이틀 바 (컬러 배경 + 제목 텍스트)
          s.addText(slide.title, {
            x: 0, y: 0, w: '100%', h: 1.15,
            fill: { color: primary },
            color: titleTextColor,
            fontSize: 19, bold: true,
            valign: 'middle',
            margin: [0, 0.5, 0, 0.5]
          });

          // 불릿 목록
          if (slide.bullets.length > 0) {
            const bulletItems = slide.bullets.map(b => ({
              text: b,
              options: { bullet: { type: 'bullet' }, indentLevel: 0 }
            }));
            s.addText(bulletItems, {
              x: 0.5, y: 1.3, w: 8.8,
              h: slide.emphasis ? 2.8 : 3.5,
              fontSize: 17, color: '1F2937',
              lineSpacingMultiple: 1.6,
              valign: 'top'
            });
          }

          // 강조 박스
          if (slide.emphasis) {
            s.addText('📌 ' + slide.emphasis, {
              x: 0.4, y: 4.35, w: 9.2, h: 0.75,
              fill: { color: 'F5F3FF' },
              line: { color: accent, width: 0.75 },
              fontSize: 13, bold: true, color: accent,
              valign: 'middle', margin: [0, 0.3, 0, 0.3]
            });
          }

          // 발표 멘트 → 발표자 노트
          if (slide.note) {
            s.addNotes(slide.note);
          }
        }
      }

      await pptx.writeFile({ fileName: `제안서_${clientInfo.domain}_${Date.now()}.pptx` });

    } catch (err) {
      alert(`PPT 생성 실패: ${err.message}`);
    } finally {
      setPptxGenerating(false);
    }
  }

  // ── HTML 슬라이드 다운로드 ──
  function handleDownloadHtml() {
    const parsedSlides = parseSlidesFromProposal(proposalEditable);
    const html = buildHtmlDocument(parsedSlides, clientInfo, winThemes);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `제안서_${clientInfo.domain}_${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ── 섹션 수정 ──
  function updateSection(idx, newContent) {
    setSections(prev => {
      const next = prev.map((s, i) => i === idx ? { ...s, content: newContent } : s);
      saveDraft({ url, edenServices, sections: next, clientInfo });
      return next;
    });
  }

  function handleSaveReport() {
    saveDraft({ url, edenServices, sections, clientInfo });
    alert("보고서가 저장되었습니다.");
  }

  function handleDownloadReport() {
    const md = sections.map(s => `## ${s.title}\n\n${s.content}`).join("\n\n---\n\n");
    const full = `# 고객사 분석 보고서 — ${clientInfo.title}\n\n${md}`;
    const blob = new Blob([full], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `분석보고서_${clientInfo.domain}_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function handleTemplateUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setTemplateFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setTemplateContent(ev.target?.result || "");
    reader.readAsText(file, "utf-8");
  }

  // ── Step 4: 제안서 생성 ──
  async function handleGenerateProposal() {
    setStep("generating");
    setPhaseProgress(0);
    setError("");
    const reportText = sections.map(s => `## ${s.title}\n\n${s.content}`).join("\n\n");
    const parts = [];

    try {
      for (let i = 0; i < PROPOSAL_PHASES.length; i++) {
        setPhaseProgress(i);
        const phase = PROPOSAL_PHASES[i];
        const prompt = buildPhasePrompt(phase, reportText, winThemes, painPoints, clientInfo, edenServices);
        const result = await callGemini([{ role: "user", content: prompt }], PROPOSAL_SYSTEM_PROMPT);
        parts.push(`# ${phase.title}\n> ${phase.subtitle}\n\n${result}`);
      }
      const full = parts.join("\n\n---\n\n");
      setProposal(full);
      setProposalEditable(full);
      setStep("proposal");
    } catch (e) {
      setError(e.message);
      setStep("report");
    }
  }

  function handleDownloadProposal() {
    const blob = new Blob([proposalEditable], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `제안서_${clientInfo.domain}_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function handleLoadDraft() {
    const draft = loadDraft();
    if (!draft) return;
    setUrl(draft.url || "");
    setEdenServices(draft.edenServices || "");
    setSections(draft.sections || []);
    setClientInfo(draft.clientInfo || {});
    setStep("report");
  }

  // ── 렌더 ──
  const draft = loadDraft();

  return (
    <div className="p-6 max-w-3xl mx-auto">

      {/* ── Step: input ── */}
      {step === "input" && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <div>
              <h4 className="text-base font-bold text-gray-800">제안서 자동화</h4>
              <p className="text-xs text-gray-400">고객사 홈페이지를 분석하고 맞춤형 PPT 제안서를 생성합니다</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              고객사 홈페이지 URL
            </label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAnalyze()}
              placeholder="https://example.com"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
            />
          </div>

          <EdenServiceSelector onChange={setEdenServices} />

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleAnalyze}
              disabled={!url.trim() || !edenServices.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              분석 시작
            </button>
            {draft && (
              <button
                onClick={handleLoadDraft}
                className="px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-all"
              >
                이전 초안 불러오기
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Step: analyzing ── */}
      {step === "analyzing" && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-5 shadow-lg animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">{analyzeMsg}</p>
          <p className="text-xs text-gray-400">잠시 기다려 주세요</p>
          <div className="mt-5 flex gap-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      )}

      {/* ── Step: generating ── */}
      {step === "generating" && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-5 shadow-lg animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">제안서 생성 중...</p>
          <p className="text-xs text-gray-500 mt-2">
            Phase {phaseProgress + 1} / {PROPOSAL_PHASES.length}: {PROPOSAL_PHASES[phaseProgress]?.title} 슬라이드 생성 중...
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {PROPOSAL_PHASES[phaseProgress]?.subtitle} ({PROPOSAL_PHASES[phaseProgress]?.slides}장)
          </p>
          <div className="mt-5 flex gap-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      )}

      {/* ── Step: report ── */}
      {step === "report" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-base font-bold text-gray-800">분석 보고서</h4>
              <p className="text-xs text-gray-400">{clientInfo.title || clientInfo.domain} — 내용을 직접 수정할 수 있습니다</p>
            </div>
            <button
              onClick={() => { setStep("input"); setError(""); }}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              다시 분석
            </button>
          </div>

          {/* Win Theme 배지 */}
          {winThemes.length > 0 && (
            <div className="mb-2">
              <h3 className="text-sm font-bold text-gray-700 mb-3">🏆 Win Theme (수주 핵심 메시지)</h3>
              <div className="grid grid-cols-3 gap-3">
                {winThemes.map((wt, i) => (
                  <div key={i} className="p-3 rounded-xl bg-violet-50 border border-violet-200">
                    <p className="text-xs font-bold text-violet-700">{wt.name}</p>
                    <p className="text-xs text-gray-600 mt-1">{wt.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PPT 디자인 템플릿 매니저 */}
          <PptTemplateManager onSelect={setSelectedTemplate} />

          {/* 섹션들 */}
          {sections.map((sec, idx) => (
            <div key={idx} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                <span className="w-5 h-5 rounded-md bg-violet-100 flex items-center justify-center text-[10px] font-bold text-violet-600">{idx + 1}</span>
                <span className="text-sm font-semibold text-gray-700">{sec.title}</span>
              </div>
              <textarea
                value={sec.content}
                onChange={e => updateSection(idx, e.target.value)}
                rows={Math.max(4, sec.content.split("\n").length + 1)}
                className="w-full px-4 py-3 text-sm text-gray-700 leading-relaxed focus:outline-none resize-y"
              />
            </div>
          ))}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSaveReport}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
              </svg>
              저장
            </button>
            <button
              onClick={handleDownloadReport}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              MD 다운로드
            </button>

            <div className="flex-1 flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  onClick={() => tplInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-violet-300 text-sm text-violet-600 bg-violet-50 hover:bg-violet-100 transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  {templateFileName || "내용 템플릿"}
                </button>
                <input
                  ref={tplInputRef}
                  type="file"
                  accept=".txt,.md,.markdown"
                  className="hidden"
                  onChange={handleTemplateUpload}
                />
                <button
                  onClick={handleGenerateProposal}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                  제안서 만들기
                </button>
              </div>
              <p className="text-xs text-gray-400 pl-1">PPT 대면 제안서 · 총 ~16장 슬라이드</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Step: proposal ── */}
      {step === "proposal" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-base font-bold text-gray-800">제안서</h4>
              <p className="text-xs text-gray-400">{clientInfo.title || clientInfo.domain} — 수정 후 PPT로 다운로드하세요</p>
            </div>
            <button
              onClick={() => setStep("report")}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              보고서로 돌아가기
            </button>
          </div>

          {/* 선택된 템플릿 표시 */}
          {selectedTemplate ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
              </svg>
              디자인 템플릿: <strong>{selectedTemplate.name}</strong>
              <span className="flex gap-1 ml-1">
                {[selectedTemplate.primaryColor, selectedTemplate.accentColor].filter(Boolean).map((c, i) => (
                  <span key={i} className="w-3 h-3 rounded-full border border-white shadow-sm inline-block" style={{ backgroundColor: c }} />
                ))}
              </span>
              <button onClick={() => setStep("report")} className="ml-auto text-blue-500 hover:text-blue-700 underline">
                변경
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-500">
              에덴 기본 보라 계열로 PPT 생성됩니다
              <button onClick={() => setStep("report")} className="ml-auto text-violet-500 hover:text-violet-700 underline">
                템플릿 선택
              </button>
            </div>
          )}

          {/* 제안서 편집 */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-700">슬라이드 스크립트</span>
              <span className="text-xs text-gray-400">수정 후 PPT 다운로드</span>
            </div>
            <textarea
              value={proposalEditable}
              onChange={e => setProposalEditable(e.target.value)}
              rows={30}
              className="w-full px-4 py-3 text-sm text-gray-700 leading-relaxed focus:outline-none resize-y font-mono"
            />
          </div>

          {/* 액션 */}
          <div className="flex gap-3">
            {/* PPT 다운로드 — 메인 */}
            <button
              onClick={handleDownloadPptx}
              disabled={pptxGenerating}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-700 text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
            >
              {pptxGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  PPT 생성 중...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                  PPT 다운로드 (.pptx)
                </>
              )}
            </button>

            {/* HTML 슬라이드 다운로드 */}
            <button
              onClick={handleDownloadHtml}
              className="flex items-center gap-2 px-4 py-3 rounded-xl border border-emerald-200 text-sm text-emerald-700 hover:bg-emerald-50 transition-all"
              title="템플릿 디자인 적용 HTML 제안서"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
              </svg>
              HTML 슬라이드
            </button>

            {/* MD 다운로드 */}
            <button
              onClick={handleDownloadProposal}
              className="flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              MD
            </button>

            {/* 복사 */}
            <button
              onClick={() => {
                navigator.clipboard.writeText(proposalEditable);
                alert("클립보드에 복사되었습니다.");
              }}
              className="flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              복사
            </button>

            {/* 재생성 */}
            <button
              onClick={handleGenerateProposal}
              className="flex items-center gap-2 px-4 py-3 rounded-xl border border-violet-200 text-sm text-violet-600 hover:bg-violet-50 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
              </svg>
              재생성
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
