import { useState } from "react";
import { callGemini } from "../utils/gemini";
import { calcPrdPct, pctColor, PRD_SECTIONS_DEF } from "../utils/prd";
import EditField from "./EditField";

export default function PRDPanel({ prd, setPrd, aiScore = 0, setAiScore }) {
  const [openSections, setOpenSections] = useState({ overview: true, core_value: true, target: false, metrics: false });
  const [isRescoring, setIsRescoring] = useState(false);

  // aiScore > 0이면 AI 점수 우선, 없으면 글자수 기반 fallback
  const pct = aiScore > 0 ? aiScore : calcPrdPct(prd);
  const color = pctColor(pct);
  const label = pct < 30 ? '미흡' : pct < 60 ? '보통' : pct < 85 ? '양호' : '우수';
  const toggle = (key) => setOpenSections(p => ({ ...p, [key]: !p[key] }));
  const update = (sKey, fKey, val) => setPrd(p => ({ ...p, [sKey]: { ...p[sKey], [fKey]: val } }));

  // PRD 수동 수정 후 AI 재평가
  const rescoreWithAI = async () => {
    if (!setAiScore || isRescoring) return;
    setIsRescoring(true);
    try {
      const prompt = `다음 PRD의 완성도를 0~100 사이 정수 하나로만 답하세요. 설명 없이 숫자만.

평가 기준:
- one_liner(핵심 설명) 20점, problem(핵심 문제) 20점, solution(해결책) 20점
- users(타겟 사용자) 10점, kpis(성공 지표) 10점
- 나머지 필드 20점 (차별점, 시나리오, 위험 요소 등)
- 내용이 구체적이고 충분할수록 높은 점수

PRD: ${JSON.stringify(prd)}`;
      const text = await callGemini([{ role: 'user', content: prompt }], '');
      const match = text.match(/\d+/);
      if (match) {
        const s = Math.min(100, Math.max(0, parseInt(match[0], 10)));
        setAiScore(s);
      }
    } catch (e) {}
    setIsRescoring(false);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="px-6 py-3 bg-white border-b border-gray-200 shrink-0 flex items-center gap-3">
        <span className="font-semibold text-gray-800 text-sm">PRD</span>
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className="text-xs font-mono font-semibold" style={{ color }}>{pct}%</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: color + '18', color }}>{label}</span>
        {setAiScore && (
          <button onClick={rescoreWithAI} disabled={isRescoring}
            title="AI로 완성도 재평가"
            className="text-xs text-gray-400 hover:text-purple-600 disabled:opacity-40 transition-colors ml-1">
            {isRescoring ? '평가 중...' : '↻ AI 재평가'}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {PRD_SECTIONS_DEF.map(sec => (
          <div key={sec.key} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <button onClick={() => toggle(sec.key)}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-purple-50 transition-colors">
              <span className="text-base">{sec.icon}</span>
              <span className="font-medium text-gray-800 text-sm flex-1">{sec.label}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5"
                style={{ transform: openSections[sec.key] ? 'rotate(180deg)' : 'rotate(0)', transition: '0.15s' }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {openSections[sec.key] && (
              <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
                {sec.fields.map(f => (
                  <div key={f.key} className="pt-3">
                    <div className="text-xs font-medium text-purple-600 uppercase tracking-wide mb-1">{f.label}</div>
                    <EditField
                      value={prd[sec.key]?.[f.key] || ''}
                      onChange={val => update(sec.key, f.key, val)}
                      multiline={f.multiline}
                      className="text-sm text-gray-700 leading-relaxed block w-full"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">⚙️</span>
            <span className="font-medium text-gray-800 text-sm">프로젝트 설정</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {prd.settings?.category && (
              <span className="px-2.5 py-1 bg-purple-50 text-purple-700 text-xs rounded-full border border-purple-200">
                {prd.settings.category}
              </span>
            )}
            {prd.settings?.roles?.map(r => (
              <span key={r} className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">{r}</span>
            ))}
            {prd.settings?.devices?.map(d => (
              <span key={d} className="px-2.5 py-1 bg-blue-50 text-blue-600 text-xs rounded-full border border-blue-200">{d}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
