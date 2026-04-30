// AI 영상편집 자동화 탭
// 영상 업로드 → 음성 추출·무음 제거 → Whisper 전사 → 소스 자동 배치 → 캡컷 드래프트
import { useState } from "react";

const AUTO_EDIT_FEATURES = [
  {
    num: "01",
    key: "transcribe",
    label: "영상 업로드 및 자동 전사",
    priority: "높음",
    priorityColor: "bg-red-100 text-red-600",
    gradient: "from-purple-500 to-violet-600",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>
      </svg>
    ),
    desc: "영상 파일을 업로드하면 음성 구간을 분석해 무음을 자동 제거하고, Whisper로 전사 후 의미 단위로 분절합니다.",
    details: ["영상 파일 업로드 (mp4·mov·avi)", "FFmpeg 음성 추출", "무음 구간 자동 감지·제거", "Whisper API 전사 + 타임스탬프", "의미 단위 자동 분절"],
    tools: ["FFmpeg", "Whisper API"],
  },
  {
    num: "02",
    key: "capcut",
    label: "캡컷 드래프트 자동 생성",
    priority: "높음",
    priorityColor: "bg-red-100 text-red-600",
    gradient: "from-violet-500 to-indigo-600",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>
      </svg>
    ),
    desc: "분석된 구간별로 강조 자막·시그니처 캐릭터·GIF 움짤을 자동 배치한 캡컷 드래프트를 3분 내에 생성합니다.",
    details: ["구간별 강조 자막 자동 배치", "시그니처 캐릭터 삽입", "Clippy GIF 움짤 검색·배치", "무음 구간 자동 제거"],
    tools: ["CapCut API", "Clippy"],
  },
  {
    num: "03",
    key: "tts",
    label: "TTS 내레이션 자동 생성",
    priority: "높음",
    priorityColor: "bg-red-100 text-red-600",
    gradient: "from-indigo-500 to-blue-600",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
      </svg>
    ),
    desc: "텍스트 스크립트를 입력하면 QN3 TTS가 사용자 목소리를 복제한 자연스러운 내레이션 음성을 30초 내에 생성합니다.",
    details: ["QN3 TTS 음성 복제", "텍스트 → 개인화 음성", "30초 내 생성", "별도 녹음 불필요"],
    tools: ["QN3 TTS"],
  },
  {
    num: "04",
    key: "hooking",
    label: "후킹 오프닝 자동 제작",
    priority: "중간",
    priorityColor: "bg-amber-100 text-amber-600",
    gradient: "from-orange-500 to-rose-500",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
      </svg>
    ),
    desc: "Kling AI 기반 비디오·RVC 음성·Remotion 모션 그래픽을 결합하여 시청자 이탈을 막는 3초 후킹 오프닝을 자동 완성합니다.",
    details: ["Kling AI 키워드 맞춤 비디오", "RVC 음성 클론 적용", "Remotion 모션 그래픽", "캡컷 타임라인 자동 삽입"],
    tools: ["Kling AI", "RVC", "Remotion"],
  },
  {
    num: "05",
    key: "chat",
    label: "대화형 드래프트 수정",
    priority: "중간",
    priorityColor: "bg-amber-100 text-amber-600",
    gradient: "from-teal-500 to-emerald-600",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    desc: "생성된 드래프트를 Claude Code와 자연어 채팅으로 자막 톤·움짤 교체·구간 배치 등을 실시간으로 수정·정교화합니다.",
    details: ["자연어 수정 요청 해석", "자막 톤·폰트 변경", "움짤 교체·구간 재배치", "Claude Code 실시간 연동"],
    tools: ["Claude Code"],
  },
];

const PIPELINE_STEPS = [
  { label: "영상 업로드", icon: "📤" },
  { label: "음성 추출·무음 제거", icon: "✂️" },
  { label: "Whisper 전사", icon: "🎙️" },
  { label: "소스 자동 배치", icon: "🎬" },
  { label: "캡컷 드래프트", icon: "✅" },
];

export default function AutoEditTab({ nasState, onGoToNas, NasSaveFooter }) {
  const [expandedKey, setExpandedKey] = useState(null);

  return (
    <div>
      {/* 헤더 */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-100">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-md flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>
            </svg>
          </div>
          <div>
            <h4 className="text-base font-bold text-gray-800">AI 영상편집 자동화</h4>
            <p className="text-xs text-gray-400 mt-0.5">영상 하나로 자막·움짤·드래프트까지 — 편집 시간 10분의 1</p>
          </div>
        </div>
      </div>

      {/* 파이프라인 흐름 */}
      <div className="px-6 py-5 bg-gray-50/60 border-b border-gray-100">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">자동화 파이프라인</p>
        <div className="flex items-center gap-1 flex-wrap">
          {PIPELINE_STEPS.map((step, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 shadow-sm">
                <span className="text-sm">{step.icon}</span>
                <span className="text-[11px] font-medium text-gray-700 whitespace-nowrap">{step.label}</span>
              </div>
              {i < PIPELINE_STEPS.length - 1 && (
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 flex-shrink-0">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 기능 목록 */}
      <div className="p-6 space-y-3">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4">주요 기능 5종</p>
        {AUTO_EDIT_FEATURES.map(feat => (
          <div
            key={feat.key}
            className={`rounded-xl border-2 overflow-hidden transition-all duration-200 ${
              expandedKey === feat.key ? "border-purple-300 bg-purple-50/30" : "border-gray-200 bg-white"
            }`}
          >
            <button
              onClick={() => setExpandedKey(expandedKey === feat.key ? null : feat.key)}
              className="w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-gray-50/60 transition-colors"
            >
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${feat.gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                {feat.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold text-gray-400 font-mono">{feat.num}</span>
                  <p className="text-sm font-semibold text-gray-800">{feat.label}</p>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${feat.priorityColor}`}>
                    중요도 {feat.priority}
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">
                    시작전
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{feat.desc}</p>
              </div>
              <svg
                xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={`text-gray-400 flex-shrink-0 transition-transform ${expandedKey === feat.key ? "rotate-180" : ""}`}
              >
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </button>

            {expandedKey === feat.key && (
              <div className="px-4 pb-4 border-t border-gray-100 bg-white/60">
                <p className="text-xs text-gray-600 leading-relaxed mt-3 mb-3">{feat.desc}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">세부 기능</p>
                    <ul className="space-y-1.5">
                      {feat.details.map((d, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400 mt-0.5 flex-shrink-0">
                            <path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                          </svg>
                          <span className="text-xs text-gray-600">{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">사용 도구</p>
                    <div className="flex flex-wrap gap-1.5">
                      {feat.tools.map(t => (
                        <span key={t} className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <NasSaveFooter nasState={nasState} subfolder="자동편집" onGoToNas={onGoToNas} />
    </div>
  );
}
