export const TH_MAX_CHARS = 500;
export const THREAD_TEMPLATE_KEY = "eattack_threads_view_template";
export const TEMPLATE_OPTIONS_KEY = "eattack_threads_template_options";
export const templateSelectionKey = (u) => `eattack_threads_template_selection_${u}_v1`;
export const autoRunKey = (u) => `eattack_threads_auto_run_${u}_v1`;
export const autoMonitorCacheKey = (u) => `eattack_threads_auto_monitor_${u}_v1`;
export const threadsKey = (u) => `eden_threads_${u}_v1`;

export const CONVERSATION_FORMATS = [
  {
    key: "expert",
    label: "전문가 설명",
    prompt: "짧고 강한 주장으로 시작하는 전문가 말투. 반전/숫자/단정형 훅 → 이유 → 적용 팁 → 낮은 허들 CTA 흐름.",
  },
  {
    key: "friend",
    label: "친구 조언",
    prompt: "친한 친구가 옆에서 바로 찌르는 말투. 공감 → 솔직한 경험 → 의외의 한 방 → 바로 해볼 행동 → 부드러운 CTA 흐름.",
  },
  {
    key: "story",
    label: "경험담",
    prompt: "개인 경험을 짧고 선명하게 던지는 말투. 상황 묘사 → 예상 밖 깨달음 → 바뀐 관점 → 독자에게 넘기는 CTA 흐름.",
  },
  {
    key: "question",
    label: "질문 유도",
    prompt: "독자에게 질문을 던지며 대화를 여는 말투. 문제 질문 → 선택지/오해 제시 → 반전 관점 → 댓글 CTA 흐름.",
  },
  {
    key: "checklist",
    label: "체크리스트",
    prompt: "짧고 실용적인 체크리스트 말투. 결론 선제시 → 3~5개 포인트 → 바로 적용 CTA 흐름. 첫 줄은 반드시 훅이어야 한다.",
  },
];

export const TONE_OPTIONS = [
  { key: "template", label: "템플릿 말투", prompt: "분석된 템플릿의 원래 말투를 최대한 유지하되 첫 문장은 더 강하게 만든다" },
  { key: "direct", label: "직설적", prompt: "짧고 단정적인 문장, 군더더기 없는 확신형 말투, 첫 문장은 설명문 금지" },
  { key: "warm", label: "따뜻한 공감", prompt: "독자의 상황을 먼저 받아주되 첫 줄은 약하지 않게, 반전이나 찌르는 포인트를 넣는다" },
  { key: "bold", label: "도발적", prompt: "익숙한 믿음을 살짝 뒤집고 강한 주장으로 끌고 가는 말투. 첫 줄이 글의 승부처다" },
  { key: "casual", label: "캐주얼", prompt: "친근하고 가벼운 대화체, 과한 전문용어를 줄인 말투. 가볍더라도 첫 문장은 흥미를 줘야 한다" },
];

export const FLOW_OPTIONS = [
  { key: "template", label: "템플릿 흐름", prompt: "저장된 템플릿의 흐름을 우선 적용하되 첫 줄은 더 강하게 조정" },
  { key: "problem", label: "문제→해결", prompt: "문제 제기 → 공감 → 해결책 → 바로 할 행동 순서. 첫 문장은 문제를 세게 찌른다" },
  { key: "value", label: "가치 선제시", prompt: "첫 줄에서 얻을 이득 제시 → 왜 필요한지 → 구성/근거 → CTA 순서. 첫 줄은 숫자나 결과로 시작" },
  { key: "story", label: "상황→깨달음", prompt: "짧은 상황 묘사 → 시행착오 → 깨달음 → 독자 적용 순서. 첫 줄은 상황 설명보다 충돌이 먼저다" },
  { key: "contrarian", label: "반전 주장", prompt: "통념 제시 → 반박 → 새로운 관점 → 확인/댓글 CTA 순서. 첫 문장은 반드시 반전 주장으로 시작" },
];

export const CTA_OPTIONS = [
  { key: "template", label: "템플릿 CTA", prompt: "저장된 템플릿의 CTA 방식을 우선 적용하되, 마지막 문장은 반드시 행동을 유도" },
  { key: "comment", label: "댓글 유도", prompt: "댓글로 키워드나 의견을 남기게 하는 낮은 허들 CTA. 끝을 질문으로 닫아도 좋다" },
  { key: "follow", label: "팔로우 유도", prompt: "비슷한 실전 팁을 계속 보고 싶으면 팔로우하도록 자연스럽게 유도하는 CTA" },
  { key: "save", label: "저장 유도", prompt: "나중에 다시 보도록 저장을 유도하는 실용형 CTA" },
  { key: "dm", label: "DM 유도", prompt: "자료/체크리스트를 받기 위한 DM 또는 키워드 요청 CTA" },
  { key: "soft", label: "부드러운 권유", prompt: "강요 없이 오늘 바로 한 가지를 해보게 하는 CTA. 하지만 문장은 흐리지 않는다" },
];

export const DEFAULT_TEMPLATE_OPTIONS = {
  format: CONVERSATION_FORMATS,
  tone: TONE_OPTIONS,
  flow: FLOW_OPTIONS,
  cta: CTA_OPTIONS,
};

export const NARROW_KEYWORD_MARKERS = [
  "ai",
  "chatgpt",
  "claude",
  "cloude",
  "code",
  "coding",
  "개발",
  "개발자",
  "앱",
  "자동화",
  "생성형ai",
];
