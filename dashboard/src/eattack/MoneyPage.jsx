// ── 이걸 돈내고 써? — Windows 앱 센터 스타일 ──
import { useState } from "react";
import EdenCanvas from "./EdenCanvas";
import EdenFlowPanel from "./EdenFlowPanel";
import EmailAttackPage from "./email-attack/EmailAttackPage";
import HookingPracticePage from "./HookingPracticePage";

// ── 툴 데이터 ──
const FREE_TOOLS = [
  {
    key: "canvas",
    label: "에덴캔버스",
    category: "디자인 도구",
    iconBg: "from-violet-500 to-purple-600",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
        <path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>
      </svg>
    ),
    description: "Figma·Canva 대신 — 카드뉴스, 배너, 썸네일 디자인을 에덴 내부에서 무료로 제작",
    longDesc: "에덴캔버스는 웹 기반 디자인 편집 도구입니다. 카드뉴스, 배너, 썸네일 등 다양한 콘텐츠를 별도 설치 없이 브라우저에서 바로 제작할 수 있습니다. 27종 도형, 멀티페이지, Undo/Redo, PNG 다운로드 등 미리캔버스급 기능을 무료로 제공합니다.",
    version: "v2.1",
    updateDate: "2026-04-15",
    updateNote: "리사이즈 핸들, 다중 선택, Ctrl+C/V, 정렬, Zoom, 드래그 선택, 테두리 기능 추가",
    developer: "에덴 에이전트",
    publisher: "에덴 에이전트",
    size: "웹 앱 (무료)",
    replaces: ["Figma 월 $15~", "Canva Pro 월 $13~"],
    features: ["드래그 앤 드롭 편집", "27종 도형·화살표·별 등", "멀티페이지 관리", "Undo/Redo 50단계", "PNG 다운로드", "Ctrl+C/V 복사붙여넣기", "리사이즈 핸들", "드래그 다중 선택"],
    isInternal: true,
    screenshots: ["canvas-1", "canvas-2", "canvas-3"],
  },
  {
    key: "edenflow",
    label: "에덴플로우",
    category: "릴스 기획 · 인사이트",
    iconBg: "from-emerald-400 to-teal-600",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10S2 17.52 2 12z"/>
        <path d="M8 12h8M12 8v8"/>
        <path d="M16 8l-4 4-4-4"/>
      </svg>
    ),
    description: "릴스 기획부터 인사이트 분석까지 — 숏폼 콘텐츠 전략을 에덴 내부에서 체계적으로 관리",
    longDesc: "에덴플로우는 릴스·숏폼 콘텐츠 기획 및 성과 인사이트를 통합 관리하는 내부 도구입니다. 트렌드 분석, 기획안 자동 생성, 업로드 스케줄 관리, 조회수·참여율 인사이트까지 한 곳에서 처리할 수 있습니다.",
    version: "v1.0",
    updateDate: "2026-04-16",
    updateNote: "최초 릴리즈 — 릴스 기획 템플릿, 인사이트 대시보드, 트렌드 분석 기능 포함",
    developer: "에덴 에이전트",
    publisher: "에덴 에이전트",
    size: "웹 앱 (무료)",
    replaces: ["notion 수기 기획", "Instagram Insights 수동 확인"],
    features: ["릴스 기획안 자동 생성", "트렌드 키워드 분석", "업로드 스케줄 관리", "조회수·참여율 인사이트", "콘텐츠 성과 비교", "숏폼 전략 리포트"],
    isInternal: true,
    screenshots: ["edenflow-1", "edenflow-2", "edenflow-3"],
  },
  {
    key: "esign",
    label: "E-Sign",
    category: "문서 서명",
    iconBg: "from-amber-400 to-orange-500",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
        <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
        <path d="m12.5 15-2-2 1-4 4-1 2 2z"/><path d="m10.5 13-1.5 4.5"/>
      </svg>
    ),
    description: "모두싸인·DocuSign 대신 — 문서 업로드, 서명 요청, PDF 다운로드까지 무료",
    longDesc: "E-Sign은 전자서명을 무료로 처리할 수 있는 에덴 내부 전용 도구입니다. PDF, HWP, DOCX 문서를 업로드하고 서명자에게 이메일로 서명을 요청할 수 있습니다. 서명 완료 시 PDF로 자동 다운로드됩니다.",
    version: "v1.2",
    updateDate: "2026-03-20",
    updateNote: "서명 필드 드래그 배치 기능 개선, 다중 서명자 지원",
    developer: "에덴 에이전트",
    publisher: "에덴 에이전트",
    size: "웹 앱 (무료)",
    url: "https://e-sign-ver2.onrender.com/",
    replaces: ["모두싸인 월 19,900원~", "DocuSign 월 $15~"],
    features: ["PDF·HWP·DOCX 업로드", "서명자 이메일 자동 발송", "필드 드래그 배치", "서명 완료 PDF 다운로드"],
    isInternal: false,
    screenshots: ["esign-1", "esign-2", "esign-3"],
  },
  {
    key: "emailAttack",
    label: "E-MAIL Attack",
    category: "영업 자동화",
    iconBg: "from-amber-400 to-orange-500",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2"/>
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
      </svg>
    ),
    description: "키워드 1개로 영업 타겟 브랜드의 이메일·홈페이지·상호를 자동 발굴",
    longDesc: "E-MAIL Attack은 키워드를 입력하면 구글(SerpAPI)과 네이버(공식 API)에서 영업 타겟이 될 만한 작은 브랜드들을 찾아내 홈페이지 이메일·상호명을 자동으로 수집하는 도구입니다. 매체·포털·대형쇼핑몰은 자동 제외하고, 유관 키워드 4~5개로 자동 확장해 한 번에 20개까지 발굴합니다. CSV 다운로드 + 이메일 일괄 복사 지원.",
    version: "v1.0",
    updateDate: "2026-06-23",
    updateNote: "최초 릴리즈 — 구글·네이버 통합 검색, 매체 자동 필터링, CSV 내보내기",
    developer: "에덴 에이전트",
    publisher: "에덴 에이전트",
    size: "웹 앱 (무료)",
    replaces: ["Hunter.io 월 $49~", "Apollo.io 월 $59~", "리스트 구매 건당 100원~"],
    features: ["키워드 → 유관 키워드 자동 확장", "구글·네이버 동시 검색", "매체·포털 자동 제외 (120개+ 도메인)", "이메일 + 상호명 + 홈페이지 추출", "CSV 다운로드", "이메일 일괄 복사"],
    isInternal: true,
    screenshots: ["emailattack-1", "emailattack-2", "emailattack-3"],
  },
  {
    key: "hookingPractice",
    label: "후킹끝구조끝",
    category: "숏폼 연습예시",
    iconBg: "from-rose-500 to-orange-500",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 5h10"/>
        <path d="M4 12h16"/>
        <path d="M4 19h10"/>
        <path d="m17 5 3 3-3 3"/>
        <path d="m17 13 3 3-3 3"/>
      </svg>
    ),
    description: "숏폼 첫 3초 후킹, 설득 구조, 마지막 CTA를 빠르게 연습하는 카피 훈련 도구",
    longDesc: "후킹끝구조끝은 숏폼 콘텐츠를 팔거나 기획할 때 필요한 후킹 문장, 설득 전개, 끝 문장을 반복 연습하는 내부 도구입니다. 서비스, 타겟, 고객 문제, 에덴의 차별점을 입력하면 손실회피·왜 지금·왜 에덴·왜 이 상품 관점의 예시를 바로 확인할 수 있습니다.",
    version: "v1.0",
    updateDate: "2026-06-24",
    updateNote: "최초 릴리즈 — 손실회피, 왜 지금, 왜 에덴, 왜 이 상품 4가지 연습 모드",
    developer: "에덴 에이전트",
    publisher: "에덴 에이전트",
    size: "웹 앱 (무료)",
    replaces: ["숏폼 카피 수기 작성", "Notion 예시 모음", "반복 피드백 시간"],
    features: ["후킹 문장 연습", "3단 설득 구조", "끝 문장 CTA", "손실회피 모드", "왜 에덴 모드", "원클릭 복사"],
    isInternal: true,
    screenshots: ["hooking-1", "hooking-2", "hooking-3"],
  },
  {
    key: "hookingExam",
    label: "실전 테스트",
    category: "숏폼 100점 시험",
    iconBg: "from-slate-800 to-gray-950",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11 12 14 22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        <path d="M7 8h6"/>
        <path d="M7 16h8"/>
      </svg>
    ),
    description: "응시자 이름을 남기고 10문제 실전 시험으로 후킹·구조 실력을 100점 만점 채점",
    longDesc: "실전 테스트는 후킹끝구조끝의 시험 모드입니다. 응시자 이름을 입력하고 시작하면 하나의 가상 광고주 페르소나를 기준으로 후킹 작성, 구조 작성, 후킹 유형 판별, 구조 판별 10문제를 풉니다. 각 문제는 10점 만점으로 환산되고, 최종 점수와 응시 히스토리가 저장됩니다.",
    version: "v1.0",
    updateDate: "2026-06-25",
    updateNote: "최초 릴리즈 — 10문제, 100점 만점, 응시자 이름, 로컬 히스토리 저장",
    developer: "에덴 에이전트",
    publisher: "에덴 에이전트",
    size: "웹 앱 (무료)",
    replaces: ["숏폼 카피 구두 테스트", "수기 점수 기록", "반복 피드백 시간"],
    features: ["응시자 이름 입력", "10문제 고정 시험", "문항별 1~10점 채점", "100점 만점 결과", "응시 히스토리 저장", "AI 피드백"],
    isInternal: true,
    screenshots: ["hooking-1", "hooking-2", "hooking-3"],
  },
];

// ── 앱 스크린샷 목업 ──
function ScreenshotMock({ id }) {
  const mocks = {
    "canvas-1": (
      <div className="w-full h-full bg-gradient-to-br from-violet-50 to-purple-100 flex flex-col p-2 gap-1 overflow-hidden">
        <div className="flex gap-1 flex-shrink-0">
          {["#e9d5ff","#c4b5fd","#a78bfa"].map((c,i)=><div key={i} style={{background:c}} className="h-4 rounded flex-1"/>)}
        </div>
        <div className="flex gap-1 flex-1 overflow-hidden">
          <div className="w-6 flex flex-col gap-0.5">
            {Array(5).fill(0).map((_,i)=><div key={i} className="h-4 rounded bg-white/60"/>)}
          </div>
          <div className="flex-1 bg-white/70 rounded relative overflow-hidden">
            <div style={{background:"#6366f1",position:"absolute",left:8,top:8,width:60,height:36,borderRadius:4}}/>
            <div style={{background:"#ec4899",borderRadius:9999,position:"absolute",left:40,top:30,width:28,height:28}}/>
            <div style={{background:"#f59e0b",position:"absolute",left:20,top:50,width:80,height:8,borderRadius:4}}/>
            <div style={{background:"#6366f1",clipPath:"polygon(50% 0%,100% 100%,0% 100%)",position:"absolute",right:10,top:10,width:30,height:26}}/>
          </div>
          <div className="w-8 bg-white/60 rounded"/>
        </div>
        <div className="text-[8px] text-violet-400 font-semibold text-center flex-shrink-0">캔버스 편집</div>
      </div>
    ),
    "canvas-2": (
      <div className="w-full h-full bg-gradient-to-br from-purple-50 to-indigo-100 flex flex-col p-2 gap-1 overflow-hidden">
        <div className="flex-shrink-0 text-[7px] text-purple-500 font-bold">도형 라이브러리</div>
        <div className="grid grid-cols-3 gap-0.5 flex-1 content-start">
          {[["#6366f1",0],["#ec4899",9999],["#f59e0b",0],["#10b981","polygon(50% 0%,0% 100%,100% 100%)"],["#3b82f6","polygon(50% 0%,100% 50%,50% 100%,0% 50%)"],["#f97316","polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)"]].map(([c,br],i)=>(
            <div key={i} className="h-7 rounded bg-white/70 flex items-center justify-center">
              <div style={{width:16,height:16,background:c,borderRadius:typeof br==="number"?br:0,clipPath:typeof br==="string"?br:undefined}}/>
            </div>
          ))}
        </div>
      </div>
    ),
    "canvas-3": (
      <div className="w-full h-full bg-gradient-to-br from-indigo-50 to-violet-100 flex gap-1 p-2 overflow-hidden">
        {[["#ffffff",["#6366f1","#ec4899"]],["#1a1a2e",["#ffffff","#aaaaaa"]],["#fef9f0",["#1f2937","#6b7280"]]].map(([bg,colors],i)=>(
          <div key={i} className="flex-1 rounded overflow-hidden border border-white/80 relative" style={{background:bg}}>
            <div className="absolute inset-0 p-1 flex flex-col gap-0.5">
              <div style={{background:colors[0],height:4,borderRadius:2,width:"80%"}}/>
              <div style={{background:colors[1],height:3,borderRadius:2,width:"60%",opacity:0.6}}/>
            </div>
            <div className="absolute bottom-1 left-1 text-[6px] font-bold" style={{color:colors[0]}}>{i+1}</div>
          </div>
        ))}
        <div className="text-[7px] text-indigo-400 font-bold self-end">멀티페이지</div>
      </div>
    ),
    "edenflow-1": (
      <div className="w-full h-full bg-gradient-to-br from-emerald-50 to-teal-100 flex flex-col p-2 gap-1 overflow-hidden">
        <div className="flex-shrink-0 text-[7px] text-emerald-600 font-bold">릴스 기획안</div>
        <div className="flex-1 bg-white/70 rounded p-1 flex flex-col gap-0.5 overflow-hidden">
          <div className="h-2 bg-emerald-300 rounded w-3/4"/>
          <div className="h-1.5 bg-gray-200 rounded w-full"/>
          <div className="h-1.5 bg-gray-200 rounded w-5/6"/>
          <div className="h-1.5 bg-gray-200 rounded w-2/3"/>
          <div className="flex gap-0.5 mt-0.5">
            {["#10b981","#34d399","#6ee7b7"].map((c,i)=><div key={i} style={{background:c}} className="h-1.5 flex-1 rounded"/>)}
          </div>
        </div>
      </div>
    ),
    "edenflow-2": (
      <div className="w-full h-full bg-gradient-to-br from-teal-50 to-emerald-100 flex flex-col p-2 gap-1 overflow-hidden">
        <div className="flex-shrink-0 text-[7px] text-teal-600 font-bold">인사이트 대시보드</div>
        <div className="flex-1 flex gap-1 overflow-hidden">
          <div className="flex-1 bg-white/70 rounded p-1 flex flex-col justify-end gap-0.5">
            {[40,60,35,80,55,90,70].map((h,i)=>(
              <div key={i} style={{height:`${h}%`,background:"#10b981",opacity:0.6+(i*0.05)}} className="w-2 rounded-t self-end"/>
            ))}
          </div>
          <div className="flex flex-col gap-0.5 justify-center">
            <div className="text-[6px] text-emerald-600 font-bold">조회수</div>
            <div className="text-[8px] text-gray-700 font-bold">12.4K</div>
            <div className="text-[6px] text-teal-500">+23%</div>
          </div>
        </div>
      </div>
    ),
    "edenflow-3": (
      <div className="w-full h-full bg-gradient-to-br from-green-50 to-teal-100 flex flex-col p-2 gap-1 overflow-hidden">
        <div className="flex-shrink-0 text-[7px] text-green-600 font-bold">트렌드 키워드</div>
        <div className="flex-1 flex flex-wrap content-start gap-0.5 overflow-hidden">
          {[["#10b981","릴스"],["#0d9488","숏폼"],["#059669","트렌드"],["#14b8a6","기획"],["#34d399","인사이트"]].map(([c,t],i)=>(
            <div key={i} style={{background:c+"22",color:c,border:`1px solid ${c}55`}} className="px-1 py-0.5 rounded text-[6px] font-semibold">{t}</div>
          ))}
        </div>
      </div>
    ),
    "hooking-1": (
      <div className="w-full h-full bg-gradient-to-br from-rose-50 to-orange-100 flex flex-col p-2 gap-1 overflow-hidden">
        <div className="text-[7px] font-bold text-rose-600">후킹</div>
        <div className="flex-1 rounded bg-gray-950 p-2 text-white">
          <div className="mb-1 h-1.5 w-10 rounded bg-orange-400"/>
          <div className="h-2 w-full rounded bg-white/90"/>
          <div className="mt-1 h-2 w-4/5 rounded bg-white/60"/>
          <div className="mt-3 h-1.5 w-16 rounded bg-orange-300"/>
        </div>
      </div>
    ),
    "hooking-2": (
      <div className="w-full h-full bg-gradient-to-br from-orange-50 to-amber-100 flex flex-col p-2 gap-1 overflow-hidden">
        <div className="text-[7px] font-bold text-orange-600">3단 구조</div>
        <div className="space-y-1">
          {[1,2,3].map((n) => (
            <div key={n} className="flex items-center gap-1 rounded bg-white/75 p-1">
              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-900 text-[7px] font-bold text-white">{n}</div>
              <div className="h-1.5 flex-1 rounded bg-orange-200"/>
            </div>
          ))}
        </div>
      </div>
    ),
    "hooking-3": (
      <div className="w-full h-full bg-gradient-to-br from-slate-50 to-rose-100 flex flex-col p-2 gap-1 overflow-hidden">
        <div className="text-[7px] font-bold text-slate-700">끝 문장</div>
        <div className="flex-1 rounded bg-white/75 p-2">
          <div className="h-2 w-full rounded bg-slate-800"/>
          <div className="mt-1 h-2 w-2/3 rounded bg-slate-300"/>
          <div className="mt-4 h-5 rounded bg-rose-500"/>
        </div>
      </div>
    ),
    "esign-1": (
      <div className="w-full h-full bg-gradient-to-br from-amber-50 to-orange-100 flex flex-col p-2 gap-1 overflow-hidden">
        <div className="flex-shrink-0 text-[7px] text-amber-600 font-bold">문서 업로드</div>
        <div className="flex-1 bg-white/70 rounded flex flex-col items-center justify-center gap-1">
          <div className="w-8 h-10 bg-amber-200 rounded-sm flex flex-col gap-0.5 p-1">
            {Array(4).fill(0).map((_,i)=><div key={i} className="h-0.5 bg-amber-400 rounded"/>)}
          </div>
          <div className="text-[6px] text-amber-500">PDF 드롭</div>
        </div>
      </div>
    ),
    "esign-2": (
      <div className="w-full h-full bg-gradient-to-br from-orange-50 to-amber-100 flex flex-col p-2 gap-1 overflow-hidden">
        <div className="flex-shrink-0 text-[7px] text-orange-600 font-bold">서명 요청</div>
        <div className="flex-1 bg-white/70 rounded p-1 flex flex-col gap-0.5 overflow-hidden">
          <div className="h-2 bg-orange-200 rounded w-3/4"/>
          <div className="h-1.5 bg-gray-200 rounded w-1/2"/>
          <div className="flex-1"/>
          <div className="h-3 bg-orange-400 rounded w-full"/>
        </div>
      </div>
    ),
    "esign-3": (
      <div className="w-full h-full bg-gradient-to-br from-yellow-50 to-orange-100 flex flex-col items-center justify-center p-2 gap-1 overflow-hidden">
        <div className="w-8 h-8 bg-green-200 rounded-full flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3"><path d="M20 6 9 17l-5-5"/></svg>
        </div>
        <div className="text-[7px] text-green-600 font-bold">서명 완료</div>
        <div className="h-2 bg-green-200 rounded w-3/4"/>
      </div>
    ),
  };
  return mocks[id] || <div className="w-full h-full bg-gray-100"/>;
}

// ── 메인 컴포넌트 ──
export default function MoneyPage({ onBack }) {
  const [activeTool, setActiveTool]       = useState(null);
  const [category, setCategory]           = useState("all"); // "all" | "active"
  const [search, setSearch]               = useState("");
  const [guideOpen, setGuideOpen]         = useState(false);

  // 에덴캔버스는 풀스크린 에디터로
  if (activeTool?.key === "canvas") {
    return <EdenCanvas onBack={() => setActiveTool(null)} />;
  }

  // 에덴플로우는 iframe 임베드
  if (activeTool?.key === "edenflow") {
    return <EdenFlowPanel onBack={() => setActiveTool(null)} />;
  }

  // E-MAIL Attack
  if (activeTool?.key === "emailAttack") {
    return <EmailAttackPage onBack={() => setActiveTool(null)} />;
  }

  // 후킹끝구조끝
  if (activeTool?.key === "hookingPractice") {
    return <HookingPracticePage onBack={() => setActiveTool(null)} />;
  }

  // 후킹끝구조끝 실전 테스트
  if (activeTool?.key === "hookingExam") {
    return <HookingPracticePage onBack={() => setActiveTool(null)} examMode />;
  }

  const filteredTools = FREE_TOOLS.filter(t =>
    (category === "all" || t.isInternal) &&
    (search === "" || t.label.toLowerCase().includes(search.toLowerCase()) || t.category.includes(search))
  );

  return (
    <div className="flex flex-col h-full bg-white select-none">

      {/* ── 상단 내비게이션 바 ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-white flex-shrink-0">
        {/* 뒤로/앞으로 */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => activeTool ? setActiveTool(null) : onBack()}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <button disabled className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 cursor-not-allowed">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>

        {/* 새로고침 */}
        <button
          onClick={() => setActiveTool(null)}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
        </button>

        {/* 검색 */}
        <div className="flex-1 max-w-xs relative">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input
            type="text"
            placeholder="앱 검색"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none transition-all"
          />
        </div>

        <div className="flex-1"/>

        {/* 확장 프로그램 가이드 */}
        <button
          onClick={() => setGuideOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          수동 설치
        </button>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
          설정
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ── 좌측 사이드바 ── */}
        <div className="w-44 border-r border-gray-200 py-3 flex-shrink-0 bg-white overflow-y-auto">
          <div className="px-3 mb-1">
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">메뉴</p>
          </div>
          {[
            { key: "all",    label: "전체 앱",
              icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
            { key: "active", label: "설치됨",
              icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> },
          ].map(item => (
            <button
              key={item.key}
              onClick={() => { setCategory(item.key); setActiveTool(null); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-all rounded-lg mx-1 ${
                category === item.key && !activeTool
                  ? "bg-blue-50 text-blue-600 font-semibold"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
              style={{width: "calc(100% - 8px)"}}
            >
              <span className={category === item.key && !activeTool ? "text-blue-600" : "text-gray-500"}>
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </div>

        {/* ── 메인 콘텐츠 ── */}
        <div className="flex-1 overflow-y-auto bg-white">
          {activeTool ? (
            <ToolDetail
              tool={activeTool}
              onBack={() => setActiveTool(null)}
            />
          ) : (
            <ToolList
              tools={filteredTools}
              onSelect={setActiveTool}
            />
          )}
        </div>
      </div>

      {/* ── 확장프로그램 가이드 모달 ── */}
      {guideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setGuideOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-bold text-gray-900">EDEN Benchmark Analyzer 설치</h3>
                <p className="text-[11px] text-gray-400">Chrome 전용 · 웹사이트 분석 → 기능명세서 자동 생성</p>
              </div>
              <button onClick={() => setGuideOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {[
                { num:1, title:"GitHub에서 파일 다운로드", desc:<>아래 링크에서 <strong>{"<>"} Code → Download ZIP</strong> 클릭<a href="https://github.com/EDEN-mainserver/copycopy-program" target="_blank" rel="noopener noreferrer" className="block mt-1.5 px-3 py-1.5 bg-gray-900 text-green-400 rounded-lg text-xs font-mono hover:bg-gray-800 transition-all">github.com/EDEN-mainserver/copycopy-program</a></> },
                { num:2, title:"ZIP 압축 해제", desc:<>압축 해제 후 <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono text-purple-700">copycopy-program-main</code> 폴더 확인</> },
                { num:3, title:"Chrome 확장 프로그램 페이지 열기", desc:<><code className="block mt-1 px-3 py-1.5 bg-gray-100 rounded-lg text-xs font-mono text-blue-700">chrome://extensions</code></> },
                { num:4, title:"개발자 모드 켜기", desc:"우측 상단 개발자 모드 토글을 파란색으로 켜기" },
                { num:5, title:"압축 해제된 확장 프로그램 로드", desc:<>좌측 상단 버튼 클릭 → <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono text-purple-700">copycopy-program-main</code> 폴더 선택</> },
                { num:6, title:"API Key 입력 후 분석 시작", desc:<>확장 프로그램 아이콘 → ⚙️ 설정에서 Claude(<code className="bg-gray-100 px-1 rounded font-mono text-xs">sk-ant-</code>) 또는 Gemini(<code className="bg-gray-100 px-1 rounded font-mono text-xs">AIza</code>) 키 입력</> },
              ].map(step => (
                <div key={step.num} className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center">{step.num}</div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 mb-0.5">{step.title}</p>
                    <div className="text-xs text-gray-500 leading-relaxed">{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 앱 목록 ──
function ToolList({ tools, onSelect }) {
  return (
    <div className="px-6 py-5">
      {tools.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-sm">검색 결과가 없습니다</p>
        </div>
      ) : (
        <div className="space-y-1">
          {tools.map(tool => (
            <ToolRow key={tool.key} tool={tool} onClick={() => onSelect(tool)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── 앱 행 (목록 아이템) ──
function ToolRow({ tool, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-gray-50 transition-all text-left group"
    >
      {/* 아이콘 */}
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tool.iconBg} flex items-center justify-center flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow`}>
        {tool.icon}
      </div>

      {/* 이름·카테고리 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{tool.label}</p>
        <p className="text-xs text-gray-400">{tool.category}</p>
      </div>

      {/* 실행 버튼 */}
      <div className="flex-shrink-0">
        <span className="inline-flex items-center gap-1.5 px-5 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm">
          실행
        </span>
      </div>
    </button>
  );
}

// ── 앱 상세 화면 ──
function ToolDetail({ tool, onBack }) {
  return (
    <div className="px-6 py-5 max-w-3xl">

      {/* 앱 헤더 행 */}
      <div className="flex items-center gap-4 mb-6">
        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${tool.iconBg} flex items-center justify-center flex-shrink-0 shadow-md`}>
          {tool.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-gray-900 leading-tight">{tool.label}</h2>
          <p className="text-sm text-gray-400">{tool.category}</p>
        </div>
        <div className="flex-shrink-0">
          {tool.isInternal ? (
            <button
              onClick={onBack}
              className="px-7 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold rounded-xl transition-colors shadow-sm"
            >
              실행하기
            </button>
          ) : (
            <a
              href={tool.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-7 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold rounded-xl transition-colors shadow-sm"
            >
              열기
            </a>
          )}
        </div>
      </div>

      {/* 스크린샷 */}
      <div className="flex gap-3 mb-7 overflow-x-auto pb-1">
        {tool.screenshots.map((id, i) => (
          <div
            key={i}
            className="flex-shrink-0 rounded-xl overflow-hidden border border-gray-200 shadow-sm"
            style={{ width: 200, height: 130 }}
          >
            <ScreenshotMock id={id} />
          </div>
        ))}
      </div>

      {/* 서비스 상세 */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-gray-900 mb-2">서비스 상세</h3>
        <p className="text-sm text-gray-600 leading-relaxed">{tool.longDesc}</p>
      </div>

      {/* 구분선 */}
      <div className="border-t border-gray-100 mb-5"/>

      {/* 최신 버전 */}
      <div className="mb-5">
        <div className="flex items-start justify-between mb-1">
          <div>
            <span className="text-sm font-bold text-gray-900">최신 버전 </span>
            <span className="text-sm font-bold text-gray-900">{tool.version}</span>
          </div>
          <span className="text-sm text-gray-400">{tool.updateDate} 업데이트</span>
        </div>
        <p className="text-sm text-gray-500">{tool.updateNote}</p>
      </div>

      {/* 구분선 */}
      <div className="border-t border-gray-100 mb-5"/>

      {/* 포함 기능 */}
      <div className="mb-5">
        <h3 className="text-base font-bold text-gray-900 mb-3">포함 기능</h3>
        <div className="grid grid-cols-2 gap-2">
          {tool.features.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* 구분선 */}
      <div className="border-t border-gray-100 mb-5"/>

      {/* 절약 비용 */}
      <div className="mb-5">
        <h3 className="text-base font-bold text-gray-900 mb-2">대체 비용 절감</h3>
        <div className="flex flex-wrap gap-2">
          {tool.replaces.map(r => (
            <span key={r} className="px-3 py-1 bg-red-50 text-red-400 text-xs font-medium rounded-lg line-through">{r}</span>
          ))}
          <span className="px-3 py-1 bg-green-50 text-green-600 text-xs font-bold rounded-lg">→ 무료 🎉</span>
        </div>
      </div>

      {/* 구분선 */}
      <div className="border-t border-gray-100 mb-5"/>

      {/* 기타 정보 */}
      <div>
        <h3 className="text-base font-bold text-gray-900 mb-2">기타 정보</h3>
        <div className="flex items-center gap-6 text-sm text-gray-600 flex-wrap">
          <span>개발자: <span className="text-blue-500 font-medium">{tool.developer}</span></span>
          <span>게시자: <span className="text-blue-500 font-medium">{tool.publisher}</span></span>
          <span>크기: <span className="font-medium">{tool.size}</span></span>
        </div>
      </div>

      {/* 하단 여백 */}
      <div className="h-8"/>
    </div>
  );
}
