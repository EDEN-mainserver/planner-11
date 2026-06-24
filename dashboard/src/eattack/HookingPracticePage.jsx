import { useEffect, useMemo, useState } from "react";

const USED_PERSONAS_KEY = "hooking-practice-used-personas-v1";
const EMPTY_PERSONA = {
  brand: "생성 중",
  owner: "AI가 새로운 광고주를 만드는 중입니다",
  product: "새로운 숏폼 판매 상품",
  audience: "새로운 구매자 타겟",
  pain: "새로운 마케팅 문제",
  desire: "숏폼으로 얻고 싶은 변화",
  objection: "구매 전 망설임",
  fingerprint: "",
};

const ENGINES = [
  { key: "fast_slow_brain", label: "빠른 뇌 vs 느린 뇌", group: "토대", definition: "즉각 반응하는 뇌에서 승부난다", tell: "0.5초 안에 이해되는 단순함", examples: ["이거 보면 끝남", "딱 봐도 다르죠?"] },
  { key: "cognitive_ease", label: "인지 편안함", group: "토대", definition: "이해가 쉬울수록 더 믿고 더 본다", tell: "쉬운 단어, 짧은 문장", examples: ["한 줄로 끝내드림", "초등학생도 아는 방법"] },
  { key: "variable_reward", label: "가변 보상", group: "토대", definition: "다음 보상을 예측 못 하면 끊기 어렵다", tell: "결과를 끝까지 안 알려줌", examples: ["마지막에 반전 있음", "끝까지 봐야 함"] },
  { key: "attention_currency", label: "주의 = 화폐", group: "토대", definition: "1초마다 주의를 뺏기는 전쟁", tell: "첫 프레임 정보·자극 밀도", examples: ["첫 장면부터 결론", "멈추는 자막"] },
  { key: "amp_specificity", label: "구체성·숫자", group: "증폭기", definition: "구체 숫자가 믿음과 관심을 만든다", tell: "3일, 87%, 9가지", examples: ["3일 만에 1000명", "87%가 모르는"] },
  { key: "amp_secondperson", label: "2인칭 호명", group: "증폭기", definition: "직접 부르면 내 얘기가 된다", tell: "당신, OO하는 분들", examples: ["당신만 모르는", "30대라면 주목"] },
  { key: "amp_timecompression", label: "시간 압축", group: "증폭기", definition: "짧은 시간으로 부담을 낮춘다", tell: "30초, 단 5분", examples: ["30초만에 정리", "단 5분이면 됨"] },
  { key: "info_gap", label: "정보 격차", group: "멈춤", definition: "알고 싶은 틈이 생기면 못 견딘다", tell: "비밀, 아무도 모르는, 공개", examples: ["99%가 모르는 법", "아무도 안 알려준 비밀"] },
  { key: "self_reference", label: "자기 호명", group: "멈춤", definition: "내 얘기 같으면 스킵이 멈춘다", tell: "특정 집단·상황을 콕 집음", examples: ["직장인이라면", "OO 사장님 주목"] },
  { key: "pattern_interrupt", label: "패턴 인터럽트", group: "멈춤", definition: "예상이 깨지면 뇌가 깨어난다", tell: "의외, 충격, 기대 위반", examples: ["생산하자마자 폐기했습니다", "여기가 한국이라니"] },
  { key: "loss_aversion", label: "손실 회피", group: "멈춤", definition: "이득보다 손해가 더 아프다", tell: "경고, 공포, 손실, 안 하면", examples: ["이거 모르면 돈 날립니다", "안 바꾸면 큰일납니다"] },
  { key: "visual_salience", label: "시각 현저성", group: "멈춤", definition: "얼굴·움직임·큰 자막이 먼저 멈춘다", tell: "시각 요소가 후킹을 담당", examples: ["이런 말 쓰는 사람 피하세요", "큰 자막+표정"] },
  { key: "open_loop", label: "열린 고리", group: "유지", definition: "끝을 안 보여주면 끝까지 본다", tell: "끝까지, 마지막에, 결론 유보", examples: ["결과는 마지막에", "과연 성공했을까요?"] },
  { key: "processing_fluency", label: "처리 유창성", group: "유지", definition: "흐름이 매끄러우면 이탈하지 않는다", tell: "군더더기 없는 전개", examples: ["딱 1분이면 이해됨", "3단계로 정리"] },
  { key: "escalating_reward", label: "점층 보상", group: "유지", definition: "정보를 조금씩 더 강하게 준다", tell: "첫째, 둘째, 마지막이 핵심", examples: ["3번부터 충격", "마지막 게 제일 중요"] },
  { key: "tension_curve", label: "긴장 곡선", group: "유지", definition: "될까 안 될까 긴장이 붙잡는다", tell: "성패 불확실, 도전 진행형", examples: ["이게 될까요?", "마지막 시도입니다"] },
  { key: "peak_end", label: "피크-엔드", group: "유지", definition: "절정과 마지막이 인상을 결정한다", tell: "강한 마무리, 반전 엔딩", examples: ["엔딩 보고 가세요", "마지막 한마디에 소름"] },
  { key: "narrative_transport", label: "이야기 몰입", group: "신뢰", definition: "스토리에 빠지면 비판이 줄어든다", tell: "사실 저, 개인 서사", examples: ["사실 저 망하기 직전이었어요", "그날 이후 바뀜"] },
  { key: "authority", label: "권위", group: "신뢰", definition: "전문가 말은 검증을 건너뛰게 한다", tell: "N년차, 전문가, 현직", examples: ["현직 의사가 말하는", "30년 경력 명장"] },
  { key: "vulnerability", label: "취약성 공개", group: "신뢰", definition: "약점을 까면 오히려 믿는다", tell: "실패, 치부 고백", examples: ["저 이거 때문에 망했어요", "처음엔 다 틀렸습니다"] },
  { key: "social_proof", label: "사회적 증거", group: "신뢰", definition: "남들이 하면 안전하다고 느낀다", tell: "요즘 다들, 후기 N개", examples: ["요즘 난리난 그것", "후기 700개 돌파"] },
  { key: "identification", label: "동일시", group: "신뢰", definition: "나랑 같네가 신뢰의 씨앗", tell: "POV, 공감 상황", examples: ["POV: 월요일 아침의 나", "이런 적 있죠?"] },
  { key: "reciprocity", label: "상호성", group: "신뢰", definition: "먼저 주면 갚고 싶어진다", tell: "무료, 전부 공개", examples: ["이거 그냥 다 공개합니다", "무료로 알려드림"] },
  { key: "consistency", label: "일관성", group: "행동", definition: "작은 동의가 큰 행동을 부른다", tell: "맞죠?, 작은 yes 유도", examples: ["한 번쯤 그런 적 있죠?", "저장만 해두세요"] },
  { key: "scarcity", label: "희소성·긴급성", group: "행동", definition: "사라진다고 하면 지금 움직인다", tell: "한정, 마감, 선착순", examples: ["오늘까지만 공개", "선착순 100명"] },
  { key: "liking", label: "호감", group: "행동", definition: "좋아하는 사람 말은 잘 따른다", tell: "친근, 매력, 공감 톤", examples: ["친구처럼 알려줄게요", "나 믿고 한 번만"] },
  { key: "anchoring", label: "대비·앵커링", group: "행동", definition: "기준점을 먼저 보면 다음 판단이 바뀐다", tell: "비교, 기준점 제시", examples: ["10만 원짜리? 이건 만 원", "원래 5배 비싼데"] },
  { key: "friction_removal", label: "마찰 제거", group: "행동", definition: "행동이 쉬울수록 더 한다", tell: "클릭만, 한 번에, 그냥", examples: ["링크 한 번만 누르면 끝", "복붙만 하면 됨"] },
];

const STRUCTURES = [
  { key: "growth_narrative", label: "성장 서사", full: "과거→문제→위기→해결→성공→CTA", hint: "못난 과거에서 성공으로 끝남" },
  { key: "self_intro", label: "자기 소개", full: "평범한 과거→계기→깨달음→변화→사명", hint: "X년 전 나는..." },
  { key: "big_dream", label: "거대한 꿈/목표", full: "꿈 선언→도전→진행→과연?", hint: "미래 목표와 결과 유보" },
  { key: "adversity", label: "역경 극복", full: "의심→투쟁→전환점→해결→통념 깨기", hint: "안 된다 했지만 해냄" },
  { key: "breakthrough", label: "획기적 발견(PS)", full: "문제→발견→해결책→결과/CTA", hint: "문제로 열고 해결책으로 닫음" },
  { key: "lesson", label: "교훈/배움", full: "좌절→고통→해결→교훈", hint: "실패담 끝에 깨달음" },
  { key: "listicle", label: "리스티클", full: "후킹(N가지)→1,2,3→마지막 강조", hint: "N가지 나열형" },
  { key: "tutorial", label: "튜토리얼", full: "문제→1단계→2단계→완성", hint: "따라하면 되는 단계 안내" },
  { key: "myth_bust", label: "신화 타파", full: "통념→반박→진실→근거", hint: "다들 틀렸다" },
  { key: "versus", label: "비교/대결", full: "A→B→차이→결론", hint: "A vs B, before/after" },
  { key: "twist", label: "반전/떡밥", full: "평범한 전개→떡밥→반전", hint: "마지막에 뒤집음" },
  { key: "challenge", label: "챌린지", full: "도전 선언→과정→결과", hint: "N일 해봤다" },
  { key: "reveal", label: "폭로/비밀", full: "떡밥→비밀 공개→상세", hint: "아무도 모르는 공개형" },
  { key: "qna", label: "큐앤에이", full: "질문→단답 반복", hint: "Q&A 반복 구조" },
  { key: "day_routine", label: "데이/루틴", full: "하루 시작→일과→마무리", hint: "OO의 하루" },
];

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function sampleOptions(list, answer, count = 4) {
  const sameGroup = list.filter((item) => item.group && answer.group && item.group === answer.group && item.key !== answer.key);
  const others = list.filter((item) => item.key !== answer.key && !sameGroup.includes(item));
  const pool = [...sameGroup.sort(() => Math.random() - 0.5), ...others.sort(() => Math.random() - 0.5)];
  return [answer, ...pool.slice(0, count - 1)].sort(() => Math.random() - 0.5);
}

function buildQuestion(persona, index) {
  const type = index % 4;
  if (type === 0) {
    const engine = pickRandom(ENGINES.filter((item) => item.group !== "토대"));
    return {
      kind: "writeHook",
      title: `${engine.label} 후킹 작성`,
      prompt: `위 광고주 페르소나를 보고 ${persona.product} 숏폼 첫 문장으로 쓸 ${engine.label} 후킹을 작성하세요.`,
      guide: `판별 단서: ${engine.tell}. 좋은 답은 페르소나 맥락과 이 단서가 동시에 보여야 합니다.`,
      target: engine,
      max: 100,
    };
  }
  if (type === 1) {
    const structure = pickRandom(STRUCTURES);
    return {
      kind: "writeStructure",
      title: `${structure.label} 기획 작성`,
      prompt: `위 광고주에 맞는 숏폼 기획을 ${structure.label} 구조로 작성하세요.`,
      guide: `단계: ${structure.full}. 판별 단서: ${structure.hint}`,
      target: structure,
      max: 100,
    };
  }
  if (type === 2) {
    const answer = pickRandom(STRUCTURES);
    return {
      kind: "chooseStructure",
      title: "구조 맞히기",
      prompt: "아래 기획은 어떤 구조일까요?",
      example: makeStructureExample(persona, answer.key),
      options: sampleOptions(STRUCTURES, answer),
      answer: answer.key,
      target: answer,
      max: 100,
    };
  }
  const answer = pickRandom(ENGINES.filter((item) => item.group !== "토대"));
  return {
    kind: "chooseHook",
    title: "심리 엔진 맞히기",
    prompt: "아래 후킹은 어떤 후킹일까요?",
    example: makeHookExample(persona, answer.key),
    options: sampleOptions(ENGINES, answer),
    answer: answer.key,
    target: answer,
    max: 100,
  };
}

function loadUsedPersonas() {
  try {
    const parsed = JSON.parse(localStorage.getItem(USED_PERSONAS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveUsedPersonas(values) {
  localStorage.setItem(USED_PERSONAS_KEY, JSON.stringify(values.slice(-500)));
}

function localFingerprint(persona) {
  return [
    persona.brand,
    persona.owner,
    persona.product,
    persona.audience,
    persona.pain,
  ]
    .map((v) => String(v || "").replace(/\s+/g, " ").trim())
    .join("|")
    .toLowerCase();
}

async function requestGeneratedPersona() {
  const used = loadUsedPersonas();
  let lastPersona = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const resp = await fetch("/api/hooking-persona", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ used }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || "페르소나 생성 실패");
    const persona = data.persona;
    const fp = persona.fingerprint || localFingerprint(persona);
    lastPersona = { ...persona, fingerprint: fp };
    if (!used.includes(fp)) {
      const nextUsed = [...used, fp];
      saveUsedPersonas(nextUsed);
      return lastPersona;
    }
  }
  if (lastPersona) {
    saveUsedPersonas([...used, lastPersona.fingerprint]);
    return lastPersona;
  }
  throw new Error("페르소나 생성 실패");
}

function makeHookExample(persona, key) {
  const fallback = `${persona.product}, 이렇게 팔면 고객은 보고도 안 삽니다.`;
  const map = {
    info_gap: `${persona.product} 고객이 구매 직전 망설이는 진짜 이유`,
    self_reference: `${persona.audience.split(" ")[0]} 고객을 상대한다면 꼭 보세요`,
    pattern_interrupt: `좋은 제품 설명이 오히려 구매를 늦출 수 있습니다`,
    loss_aversion: `${persona.product}, 이렇게 팔면 고객은 보고도 안 삽니다`,
    visual_salience: `이 자막 하나면 ${persona.brand} 고객이 멈춥니다`,
    open_loop: `${persona.brand} 전환율이 낮은 이유, 마지막에 공개합니다`,
    processing_fluency: `${persona.product} 팔리는 구조, 3단계로 끝냅니다`,
    escalating_reward: `첫째는 후킹, 둘째는 신뢰, 마지막이 진짜 전환입니다`,
    tension_curve: `${persona.brand} 숏폼, 이 기획으로 상담이 늘까요?`,
    peak_end: `마지막 한 문장이 ${persona.product} 구매를 결정합니다`,
    narrative_transport: `사실 이 대표님도 처음엔 숏폼을 믿지 않았습니다`,
    authority: `7년차 퍼널 기획자가 보는 ${persona.brand}의 문제`,
    vulnerability: `${persona.brand}가 놓친 걸 솔직히 말하겠습니다`,
    social_proof: `요즘 ${persona.audience.split(" ")[0]} 고객은 이렇게 비교합니다`,
    identification: `POV: ${persona.pain} 때문에 답답한 대표님`,
    reciprocity: `${persona.product} 숏폼 기획법, 그냥 공개합니다`,
    consistency: `상담 전환이 낮았던 적 있죠? 그럼 이걸 보세요`,
    scarcity: `${persona.brand}가 이번 달 안에 잡아야 할 숏폼 각도`,
    liking: `대표님, 이건 친구처럼 솔직히 말할게요`,
    anchoring: `광고비 100만원보다 이 10초가 먼저입니다`,
    friction_removal: `${persona.product} 숏폼, 이 문장만 바꾸면 시작됩니다`,
    amp_specificity: `${persona.brand} 전환을 막는 3가지 장면`,
    amp_secondperson: `${persona.product} 파는 대표님, 이 실수 하지 마세요`,
    amp_timecompression: `30초만에 ${persona.brand} 숏폼 각도 정리합니다`,
  };
  return map[key] || fallback;
}

function makeStructureExample(persona, key) {
  const map = {
    growth_narrative: `처음엔 ${persona.pain}. 전환점을 찾고 ${persona.desire}를 보여준 뒤 상담으로 연결한다.`,
    self_intro: `대표가 왜 ${persona.product}를 만들었는지, 실패와 깨달음, 지금의 사명 순서로 말한다.`,
    big_dream: `${persona.brand}가 ${persona.audience.split(" ")[0]} 고객의 선택 기준을 바꾸겠다는 목표를 선언하고 과정을 보여준다.`,
    adversity: `다들 ${persona.objection}라 했지만, ${persona.pain}를 숏폼 퍼널로 돌파하는 과정을 보여준다.`,
    breakthrough: `문제: ${persona.pain}. 발견: 고객은 설명보다 장면을 믿는다. 해결: ${persona.desire}.`,
    lesson: `${persona.pain}를 겪으며 깨달은 교훈과, 같은 실수를 피하는 방법을 전달한다.`,
    listicle: `${persona.product} 고객이 구매 전 확인하는 3가지 기준을 순서대로 보여준다.`,
    tutorial: `${persona.pain}를 해결하는 1단계, 2단계, 3단계 실행법을 안내한다.`,
    myth_bust: `${persona.product}는 설명을 많이 해야 팔린다는 통념을 반박하고 진짜 구매 이유를 밝힌다.`,
    versus: `일반 홍보 영상과 ${persona.brand} 퍼널형 숏폼을 비교해 차이를 보여준다.`,
    twist: `평범한 제품 소개처럼 시작하지만, 마지막에 고객이 진짜 망설이는 이유를 뒤집어 공개한다.`,
    challenge: `${persona.brand}가 7일 동안 숏폼 각도를 바꿔보고 상담 변화 결과를 공개한다.`,
    reveal: `${persona.audience.split(" ")[0]} 고객이 말하지 않는 구매 기준을 폭로한다.`,
    qna: `Q. 왜 구매를 망설이나요? A. ${persona.objection}. Q. 그럼 어떻게 설득하나요? A. ${persona.desire}.`,
    day_routine: `${persona.product}가 필요한 고객의 하루를 따라가며 문제와 해결 순간을 보여준다.`,
  };
  return map[key];
}

function gradeChoice(question, answer) {
  const correct = answer === question.answer;
  const picked = question.options.find((item) => item.key === answer);
  const target = question.target;
  const pickedTell = picked?.tell || picked?.hint || "";
  const targetTell = target?.tell || target?.hint || "";
  return {
    score: correct ? 100 : 0,
    verdict: correct ? "통과" : "재작성",
    summary: correct
      ? `${target.label}의 판별 단서를 정확히 봤습니다.`
      : `정답은 ${target.label}입니다. ${picked?.label || "선택지"}와 판별 단서가 다릅니다.`,
    checks: [
      { ok: correct, label: correct ? "정답입니다" : `정답: ${target.label}` },
      { ok: true, label: `정답 이유: ${target.definition || target.full}` },
      { ok: true, label: `판별 단서: ${targetTell}` },
      ...(correct ? [] : [{ ok: false, label: `${picked?.label || "선택"}의 단서: ${pickedTell}` }]),
    ],
    model_answers: target.examples || [],
  };
}

async function gradeSubjective(question, answer, persona) {
  const mode = question.kind === "writeHook" ? "hook" : "structure";
  const resp = await fetch("/api/hooking-grade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode,
      persona,
      target: question.target,
      answer,
    }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || "채점 실패");
  return data.result;
}

export default function HookingPracticePage({ onBack }) {
  const [persona, setPersona] = useState(EMPTY_PERSONA);
  const [loadingPersona, setLoadingPersona] = useState(true);
  const [personaError, setPersonaError] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [selected, setSelected] = useState("");
  const [history, setHistory] = useState([]);
  const [result, setResult] = useState(null);
  const [grading, setGrading] = useState(false);
  const [gradeError, setGradeError] = useState("");
  const question = useMemo(() => buildQuestion(persona, questionIndex), [persona, questionIndex]);
  const isChoice = question.kind === "chooseStructure" || question.kind === "chooseHook";
  const total = history.reduce((sum, item) => sum + item.score, 0);
  const maxTotal = history.reduce((sum, item) => sum + item.max, 0);
  const percent = maxTotal ? Math.round((total / maxTotal) * 100) : 0;

  const resetPersona = async () => {
    setLoadingPersona(true);
    setPersonaError("");
    setQuestionIndex(0);
    setAnswer("");
    setSelected("");
    setResult(null);
    setGradeError("");
    setHistory([]);
    try {
      setPersona(await requestGeneratedPersona());
    } catch (e) {
      setPersonaError(e.message);
    } finally {
      setLoadingPersona(false);
    }
  };

  useEffect(() => {
    resetPersona();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    const value = isChoice ? selected : answer;
    if (!value.trim()) return;
    setGrading(true);
    setGradeError("");
    try {
      const graded = isChoice
        ? gradeChoice(question, value)
        : await gradeSubjective(question, value, persona);
      const next = { ...graded, title: question.title, max: question.max };
      setResult(next);
      setHistory((prev) => [...prev, next]);
    } catch (e) {
      setGradeError(e.message);
    } finally {
      setGrading(false);
    }
  };

  const nextQuestion = () => {
    setQuestionIndex((prev) => prev + 1);
    setAnswer("");
    setSelected("");
    setResult(null);
    setGradeError("");
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-[#f5f6f8]">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white/95 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100" aria-label="뒤로가기">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-black tracking-tight text-gray-950">후킹끝구조끝</h1>
            <p className="text-xs text-gray-500">가상 광고주 페르소나를 보고 숏폼 후킹과 구조를 훈련합니다</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-right">
            <p className="text-[10px] font-bold text-gray-400">TOTAL SCORE</p>
            <p className="text-lg font-black text-gray-950">{total}<span className="text-xs text-gray-400"> / {maxTotal}</span></p>
          </div>
          <button
            onClick={resetPersona}
            disabled={loadingPersona}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {loadingPersona ? "생성 중..." : "새 페르소나"}
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-5 px-6 py-6 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-4">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.15em] text-orange-500">Generated Advertiser</p>
                <h2 className="mt-1 text-2xl font-black text-gray-950">{persona.brand}</h2>
                <p className="text-sm text-gray-500">{persona.owner}</p>
              </div>
              <div className="rounded-xl bg-gray-950 px-3 py-2 text-center text-white">
                <p className="text-[10px] text-gray-400">점수율</p>
                <p className="text-lg font-black">{percent}%</p>
              </div>
            </div>
            <PersonaRow label="상품" value={persona.product} />
            <PersonaRow label="타겟" value={persona.audience} />
            <PersonaRow label="문제" value={persona.pain} />
            <PersonaRow label="욕구" value={persona.desire} />
            <PersonaRow label="저항" value={persona.objection} />
            {personaError && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                {personaError}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-black text-gray-900">누적 기록</h3>
            {history.length === 0 ? (
              <p className="text-sm text-gray-400">아직 제출한 답이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {history.map((item, index) => (
                  <div key={`${item.title}-${index}`} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs">
                    <span className="font-bold text-gray-700">{index + 1}. {item.title}</span>
                    <span className="font-black text-gray-950">{item.score}/{item.max}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>

        <section className="space-y-4">
          <div className="rounded-2xl border border-gray-900 bg-gray-950 p-5 text-white shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-300">Question {questionIndex + 1}</p>
                <h2 className="mt-1 text-2xl font-black">{question.title}</h2>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-gray-200">{question.max}점</span>
            </div>
            <p className="text-base font-bold leading-7">{question.prompt}</p>
            {question.guide && <p className="mt-3 text-sm leading-6 text-gray-300">{question.guide}</p>}
          </div>

          {question.example && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
              <p className="mb-1 text-[11px] font-black text-orange-700">제시문</p>
              <p className="text-sm font-bold leading-7 text-gray-950">{question.example}</p>
            </div>
          )}

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            {isChoice ? (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {question.options.map((option) => (
                  <button
                    key={option.key}
                    onClick={() => setSelected(option.key)}
                    disabled={!!result}
                    className={`rounded-xl border p-4 text-left transition ${
                      selected === option.key
                        ? "border-orange-400 bg-orange-50"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    } ${result ? "cursor-default" : ""}`}
                  >
                    <p className="font-black text-gray-950">{option.label}</p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">{option.full || option.hint}</p>
                  </button>
                ))}
              </div>
            ) : (
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={!!result}
                rows={8}
                placeholder="여기에 답을 작성하세요."
                className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-7 text-gray-900 outline-none focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100 disabled:opacity-70"
              />
            )}

            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-400">주관식은 후킹성, 페르소나 반영, 구조 정확도 기준으로 즉시 채점됩니다.</p>
              {!result ? (
                <button
                  onClick={submit}
                  disabled={grading}
                  className="rounded-lg bg-gray-950 px-5 py-2 text-sm font-black text-white hover:bg-black disabled:opacity-50"
                >
                  {grading ? "채점 중..." : "제출"}
                </button>
              ) : (
                <button onClick={nextQuestion} className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-black text-white hover:bg-orange-600">
                  다음 문제
                </button>
              )}
            </div>
            {gradeError && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                {gradeError}
              </div>
            )}
          </div>

          {result && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-black text-gray-950">채점 결과</h3>
                <span className={`rounded-full px-3 py-1 text-sm font-black ${
                  result.score >= 80 ? "bg-green-100 text-green-700" : result.score >= 60 ? "bg-yellow-100 text-yellow-700" : "bg-rose-100 text-rose-700"
                }`}>
                  {result.score}/{result.max}
                </span>
              </div>
              <p className="mb-4 text-sm leading-7 text-gray-700">{result.summary || result.feedback}</p>
              {result.coaching?.length > 0 && (
                <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {result.coaching.map((item) => (
                    <div key={item.item} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-black text-gray-900">{item.item}</p>
                        <span className="text-xs font-black text-gray-500">{item.got}/{item.max}</span>
                      </div>
                      <p className="text-xs leading-5 text-gray-600"><strong>왜:</strong> {item.why}</p>
                      <p className="mt-1 text-xs leading-5 text-orange-700"><strong>개선:</strong> {item.how}</p>
                    </div>
                  ))}
                </div>
              )}
              {result.checks?.length > 0 && (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {result.checks.map((check) => (
                    <div key={check.label} className={`rounded-lg border px-3 py-2 text-sm ${
                      check.ok ? "border-green-200 bg-green-50 text-green-800" : "border-rose-200 bg-rose-50 text-rose-800"
                    }`}>
                      <span className="font-black">{check.ok ? "OK" : "MISS"}</span> {check.label}
                    </div>
                  ))}
                </div>
              )}
              {result.rewrite && (
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <p className="mb-2 text-[11px] font-black text-gray-500">Before</p>
                    <p className="text-sm leading-7 text-gray-700">{result.rewrite.before}</p>
                  </div>
                  <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                    <p className="mb-2 text-[11px] font-black text-orange-700">After</p>
                    <p className="text-sm font-bold leading-7 text-gray-950">{result.rewrite.after}</p>
                    <p className="mt-2 text-xs leading-5 text-orange-700">{result.rewrite.changed}</p>
                  </div>
                </div>
              )}
              {result.model_answers?.length > 0 && (
                <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
                  <p className="mb-2 text-sm font-black text-gray-900">모범답안</p>
                  <div className="space-y-2">
                    {result.model_answers.map((item, index) => (
                      <p key={`${item}-${index}`} className="rounded-lg bg-gray-50 px-3 py-2 text-sm leading-6 text-gray-700">
                        {index + 1}. {item}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function PersonaRow({ label, value }) {
  return (
    <div className="mb-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
      <p className="text-[10px] font-black text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-6 text-gray-800">{value}</p>
    </div>
  );
}
