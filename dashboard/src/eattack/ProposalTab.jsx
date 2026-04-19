/**
 * 제안서 자동화 탭
 * 흐름: URL 입력 → 고객사 분석 → 보고서 편집 → 제안서 생성
 */
import { useState, useRef } from "react";
import { callGemini } from "../utils/gemini";

// ── 상수 ──
const LS_KEY = "eden_proposal_v1";

const SYSTEM_PROMPT = `
당신은 10년차 콘텐츠 마케터이자 퍼포먼스 마케터입니다.
브랜드 포지셔닝, 고객 심리, 디지털 광고, SNS 마케팅, 전환율 최적화에 깊은 전문성을 보유하고 있습니다.
클라이언트의 비즈니스를 빠르게 파악하고, 데이터 기반으로 마케팅 기회를 도출하는 것이 강점입니다.
반드시 한국어로 답변하세요.
`.trim();

// 로컬스토리지 저장/로드
function saveDraft(data) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
}
function loadDraft() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch { return null; }
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
  // 섹션이 없으면 전체를 하나로
  if (sections.length === 0) {
    sections.push({ title: "분석 결과", content: text });
  }
  return sections.map(s => ({ ...s, content: s.content.trim() }));
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
  const [sections, setSections] = useState([]); // [{ title, content }]
  const [clientInfo, setClientInfo] = useState({ domain: "", title: "" });

  // Step 4 - 제안서
  const [templateContent, setTemplateContent] = useState("");
  const [templateFileName, setTemplateFileName] = useState("");
  const [proposal, setProposal] = useState("");
  const [proposalEditable, setProposalEditable] = useState("");

  const fileInputRef = useRef(null);
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
      // 1. URL 크롤링
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

      // 2. Gemini 분석
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
`.trim();

      const raw = await callGemini([{ role: "user", content: prompt }], SYSTEM_PROMPT);
      const parsed = parseSections(raw);

      setSections(parsed);
      saveDraft({ url: url.trim(), edenServices, sections: parsed, clientInfo: { domain: crawlData.domain, title: crawlData.meta?.title || crawlData.domain } });
      setStep("report");

    } catch (e) {
      setError(e.message);
      setStep("input");
    }
  }

  // 섹션 내용 수정
  function updateSection(idx, newContent) {
    setSections(prev => {
      const next = prev.map((s, i) => i === idx ? { ...s, content: newContent } : s);
      saveDraft({ url, edenServices, sections: next, clientInfo });
      return next;
    });
  }

  // 보고서 저장 (로컬)
  function handleSaveReport() {
    saveDraft({ url, edenServices, sections, clientInfo });
    alert("보고서가 저장되었습니다.");
  }

  // 보고서 MD 다운로드
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

  // 템플릿 파일 업로드
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
    setError("");

    const reportText = sections.map(s => `## ${s.title}\n\n${s.content}`).join("\n\n");
    const tplPart = templateContent
      ? `\n\n**제안서 템플릿 구조:**\n${templateContent}\n위 템플릿 구조를 그대로 따르되, 내용은 분석 결과에 맞게 채워주세요.`
      : "\n\n(별도 템플릿 없음 — 아래 표준 구조로 작성: 표지/요약/고객사현황/제안개요/기대효과/서비스소개/제안금액/맺음말)";

    const prompt = `
다음 마케팅 분석 보고서를 바탕으로 **에덴 서비스 제안서**를 작성해 주세요.

**분석 보고서:**
${reportText}

**에덴의 서비스:**
${edenServices}

**고객사:** ${clientInfo.title} (${clientInfo.domain})
${tplPart}

제안서는 다음 기준으로 작성해 주세요:
- 고객사 맞춤형으로 구체적이고 설득력 있게 작성
- 고객사의 니즈와 에덴 서비스가 어떻게 맞닿는지 명확히 제시
- 수치나 예상 효과를 포함하여 신뢰성 확보
- 전문적이고 깔끔한 비즈니스 문체 사용
- 마크다운 형식으로 작성 (## 섹션 헤더 사용)
`.trim();

    try {
      const result = await callGemini([{ role: "user", content: prompt }], SYSTEM_PROMPT);
      setProposal(result);
      setProposalEditable(result);
      setStep("proposal");
    } catch (e) {
      setError(e.message);
      setStep("report");
    }
  }

  // 제안서 다운로드
  function handleDownloadProposal() {
    const blob = new Blob([proposalEditable], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `제안서_${clientInfo.domain}_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // 초안 불러오기
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
              <p className="text-xs text-gray-400">고객사 홈페이지를 분석하고 맞춤형 제안서를 생성합니다</p>
            </div>
          </div>

          {/* 고객사 URL */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              고객사 홈페이지 URL
              <span className="ml-1 text-xs font-normal text-gray-400">분석할 사이트 주소를 입력하세요</span>
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAnalyze()}
                placeholder="https://example.com"
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
              />
            </div>
          </div>

          {/* 에덴 서비스 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              에덴의 서비스
              <span className="ml-1 text-xs font-normal text-gray-400">고객사에 제안할 우리 서비스를 입력하세요</span>
            </label>
            <textarea
              value={edenServices}
              onChange={e => setEdenServices(e.target.value)}
              rows={5}
              placeholder={`예시:\n- 인스타그램/유튜브 쇼츠 콘텐츠 자동 생성 서비스\n- AI 기반 카드뉴스 제작 (월 30건)\n- 퍼포먼스 마케팅 대행 (Meta/Google 광고)\n- 브랜드 SNS 계정 운영 대행`}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent resize-none leading-relaxed"
            />
          </div>

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
          <p className="text-xs text-gray-400">AI가 맞춤형 제안서를 작성하고 있습니다</p>
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
          {/* 헤더 */}
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

          {/* 액션 버튼 */}
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

            {/* 제안서 만들기 */}
            <div className="flex-1 flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  onClick={() => tplInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-violet-300 text-sm text-violet-600 bg-violet-50 hover:bg-violet-100 transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  {templateFileName || "템플릿 첨부"}
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
              {templateFileName && (
                <p className="text-xs text-violet-500 pl-1">템플릿: {templateFileName}</p>
              )}
              {!templateFileName && (
                <p className="text-xs text-gray-400 pl-1">템플릿 미첨부 시 기본 구조로 생성됩니다</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Step: proposal ── */}
      {step === "proposal" && (
        <div className="space-y-5">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-base font-bold text-gray-800">제안서</h4>
              <p className="text-xs text-gray-400">{clientInfo.title || clientInfo.domain} — 내용을 직접 수정 후 다운로드하세요</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStep("report")}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                보고서로 돌아가기
              </button>
            </div>
          </div>

          {/* 제안서 편집 */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-700">제안서 내용</span>
              <span className="text-xs text-gray-400">자유롭게 수정 가능</span>
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
            <button
              onClick={handleDownloadProposal}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              MD 다운로드
            </button>
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
