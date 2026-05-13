import ErrorBox from "../ErrorBox";
import StepBar from "../StepBar";
import UserBar from "../UserBar";
import TopicPicker from "../../TopicPicker";

const TEMPLATE_OPTIONS = [
  {
    id: "premium",
    label: "✨ 프리미엄",
    sub: "어두운 톤·인스타 클래식",
    activeClass: "border-violet-400 bg-violet-50",
    pillClass: "bg-violet-500 text-white",
    titleClass: "text-violet-700",
  },
  {
    id: "highest",
    label: "🔥 HIGHEST",
    sub: "밝은 톤·오렌지 강조·Pretendard",
    activeClass: "border-orange-400 bg-orange-50",
    pillClass: "bg-orange-500 text-white",
    titleClass: "text-orange-700",
  },
];

export default function SetupStep({
  session,
  onLogout,
  step,
  onStepClick,
  topic,
  setTopic,
  showTopicPicker,
  setShowTopicPicker,
  brandName,
  setBrandName,
  color1,
  setColor1,
  color2,
  setColor2,
  templateId,
  setTemplateId,
  tone,
  setTone,
  purpose,
  setPurpose,
  slideCount,
  setSlideCount,
  toneOpts,
  purposeOpts,
  startResearch,
  error,
}) {
  return (
    <div className="p-6 space-y-5">
      <UserBar session={session} onLogout={onLogout} />
      <StepBar step={step} onStepClick={onStepClick} />
      {error && <ErrorBox msg={error} />}

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

      {/* 디자인 템플릿 */}
      <div>
        <label className="text-xs font-bold text-gray-700 block mb-1.5">디자인 템플릿</label>
        <div className="grid grid-cols-2 gap-2">
          {TEMPLATE_OPTIONS.map((opt) => {
            const active = templateId === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setTemplateId(opt.id)}
                className={`relative flex flex-col gap-1 p-3 rounded-xl border-2 text-left transition-all
                  ${active ? opt.activeClass : "border-gray-200 bg-white hover:border-gray-300"}`}
              >
                {active && (
                  <span className={`absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${opt.pillClass}`}>선택됨</span>
                )}
                <span className={`text-sm font-bold ${opt.titleClass}`}>{opt.label}</span>
                <span className="text-[10px] text-gray-500 leading-relaxed">{opt.sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 톤 */}
      <div>
        <label className="text-xs font-bold text-gray-700 block mb-1.5">톤 / 분위기</label>
        <div className="flex flex-wrap gap-2">
          {toneOpts.map((o) => (
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
          {purposeOpts.map((o) => (
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
}
