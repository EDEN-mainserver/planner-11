import { useMemo, useState } from "react";

const PERSONAS = [
  {
    brand: "루미스킨",
    owner: "3년차 뷰티 브랜드 대표",
    product: "비건 수분크림",
    audience: "성분은 따지지만 광고는 잘 믿지 않는 25~34세 여성",
    pain: "제품력은 있는데 상세페이지 이탈이 높고 재구매 이유가 약함",
    desire: "성분 신뢰와 사용감을 짧은 영상으로 납득시키고 싶음",
    objection: "숏폼을 해도 조회수만 나오고 구매는 안 날까 봐 걱정",
  },
  {
    brand: "핏루틴",
    owner: "온라인 PT 코치",
    product: "12주 홈트 코칭",
    audience: "헬스장 등록은 부담스럽고 혼자 운동은 계속 실패한 직장인",
    pain: "무료 운동 영상과 차별점이 약해 상담 전환이 낮음",
    desire: "왜 혼자 하면 실패하는지 보여주고 유료 코칭 필요성을 만들고 싶음",
    objection: "운동 콘텐츠는 이미 너무 많다고 생각함",
  },
  {
    brand: "모아클래스",
    owner: "키즈 영어 교육원 원장",
    product: "초등 영어 말하기 클래스",
    audience: "아이 영어 발화가 늦어 불안한 초등 저학년 학부모",
    pain: "커리큘럼 설명은 많은데 학부모가 체감할 변화가 잘 안 보임",
    desire: "수업 전후 변화를 짧은 사례형 콘텐츠로 보여주고 싶음",
    objection: "교육 광고처럼 보이면 학부모가 넘길까 봐 걱정",
  },
  {
    brand: "세이프박스",
    owner: "소형 SaaS 대표",
    product: "개인사업자 세금 자동정리 서비스",
    audience: "세금 신고 때마다 자료 정리에 지치는 1인 사업자",
    pain: "기능은 많은데 고객이 가입 전 필요성을 크게 못 느낌",
    desire: "방치하면 생기는 세금 리스크를 쉽게 보여주고 싶음",
    objection: "B2B SaaS는 숏폼으로 팔기 어렵다고 생각함",
  },
  {
    brand: "스테이온",
    owner: "숙박 예약 대행 스타트업 대표",
    product: "감성 숙소 예약 대행",
    audience: "숙소 선택에 실패하고 싶지 않은 커플 여행객",
    pain: "예쁜 숙소 이미지는 많지만 예약 결정까지 이어지는 이유가 약함",
    desire: "고객이 실패하지 않는 선택 기준을 콘텐츠로 만들고 싶음",
    objection: "이미 인스타 숙소 계정이 너무 많다고 느낌",
  },
];

const HOOK_TYPES = [
  { key: "negative", label: "부정형 후킹", hint: "하지 마세요, 망합니다, 놓칩니다처럼 경고로 시작" },
  { key: "question", label: "질문형 후킹", hint: "상대가 자기 이야기라고 느끼는 질문" },
  { key: "contrast", label: "반전형 후킹", hint: "상식과 반대되는 주장으로 멈추게 함" },
  { key: "number", label: "숫자형 후킹", hint: "3가지, 10초, 1개처럼 구체 숫자로 압축" },
];

const STRUCTURES = [
  {
    key: "PS",
    label: "PS 구조",
    full: "Problem - Solution",
    hint: "문제를 먼저 찍고 바로 해결 방향을 제시",
  },
  {
    key: "PAS",
    label: "PAS 구조",
    full: "Problem - Agitate - Solution",
    hint: "문제, 방치 시 손실, 해결책 순서",
  },
  {
    key: "AIDA",
    label: "AIDA 구조",
    full: "Attention - Interest - Desire - Action",
    hint: "주의, 관심, 욕구, 행동 순서",
  },
  {
    key: "BAB",
    label: "BAB 구조",
    full: "Before - After - Bridge",
    hint: "현재 상태, 바뀐 미래, 연결 다리",
  },
];

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function buildQuestion(persona, index) {
  const type = index % 4;
  if (type === 0) {
    return {
      kind: "writeHook",
      title: "부정형 후킹 작성",
      prompt: `위 광고주 페르소나를 보고 ${persona.product} 숏폼 첫 문장으로 쓸 부정형 후킹을 작성하세요.`,
      guide: "좋은 답: 경고/손실이 있고, 광고주의 고객 문제를 건드립니다. 45자 안팎이면 더 좋습니다.",
      max: 25,
    };
  }
  if (type === 1) {
    return {
      kind: "writeStructure",
      title: "PS 구조 기획 작성",
      prompt: `위 광고주에 맞는 숏폼 기획을 PS 구조로 작성하세요.`,
      guide: "P에는 고객 문제, S에는 해결 방향이 분명해야 합니다.",
      max: 25,
    };
  }
  if (type === 2) {
    const answer = pickRandom(STRUCTURES);
    return {
      kind: "chooseStructure",
      title: "구조 맞히기",
      prompt: "아래 기획은 어떤 구조일까요?",
      example: makeStructureExample(persona, answer.key),
      options: STRUCTURES,
      answer: answer.key,
      max: 25,
    };
  }
  const answer = pickRandom(HOOK_TYPES);
  return {
    kind: "chooseHook",
    title: "후킹 유형 맞히기",
    prompt: "아래 후킹은 어떤 후킹일까요?",
    example: makeHookExample(persona, answer.key),
    options: HOOK_TYPES,
    answer: answer.key,
    max: 25,
  };
}

function makeHookExample(persona, key) {
  const map = {
    negative: `${persona.product}, 이렇게 팔면 고객은 보고도 안 삽니다.`,
    question: `${persona.audience.split(" ")[0]} 고객은 왜 장바구니에서 멈출까요?`,
    contrast: `좋은 제품 설명이 오히려 구매를 늦출 수 있습니다.`,
    number: `10초 안에 ${persona.brand} 고객을 멈추는 3가지 장면`,
  };
  return map[key];
}

function makeStructureExample(persona, key) {
  const map = {
    PS: `문제: ${persona.pain}. 해결: ${persona.desire}를 첫 3초 후킹과 CTA로 연결한다.`,
    PAS: `문제: ${persona.pain}. 방치하면 ${persona.objection}. 그래서 ${persona.desire}를 보여주는 숏폼 퍼널이 필요하다.`,
    AIDA: `멈춤: ${persona.product}의 오해를 건드린다. 관심: 고객 상황을 보여준다. 욕구: 변화 장면을 제시한다. 행동: 상담으로 연결한다.`,
    BAB: `전: ${persona.pain}. 후: 고객이 필요성을 바로 이해한다. 다리: ${persona.desire}를 숏폼 구조로 만든다.`,
  };
  return map[key];
}

function scoreHook(answer, persona) {
  const text = answer.trim();
  let score = 0;
  const checks = [];
  const negativeWords = ["안", "못", "손해", "실패", "놓치", "망", "위험", "하지 마", "늦"];
  const personaWords = [persona.product, persona.audience, persona.pain, persona.objection]
    .join(" ")
    .split(/\s+/)
    .filter((word) => word.length >= 2);

  const hasNegative = negativeWords.some((word) => text.includes(word));
  const hasPersona = personaWords.some((word) => text.includes(word));
  const shortEnough = text.length >= 12 && text.length <= 55;
  const hasSpecific = /고객|구매|문의|매출|상담|전환|조회수|신뢰|광고/.test(text);
  const noGeneric = !/최고|완벽|혁신|대박|무조건/.test(text);

  if (hasNegative) score += 7;
  checks.push({ ok: hasNegative, label: "부정형 경고가 보임" });
  if (hasPersona) score += 6;
  checks.push({ ok: hasPersona, label: "광고주/고객 맥락을 반영함" });
  if (shortEnough) score += 5;
  checks.push({ ok: shortEnough, label: "숏폼 첫 문장 길이에 적합함" });
  if (hasSpecific) score += 5;
  checks.push({ ok: hasSpecific, label: "전환/구매/고객 문제를 건드림" });
  if (noGeneric && text.length > 0) score += 2;
  checks.push({ ok: noGeneric, label: "빈말/과장 표현이 적음" });

  return {
    score: Math.min(25, score),
    checks,
    feedback: score >= 20
      ? "좋아요. 멈추게 하는 경고와 고객 맥락이 같이 들어갔습니다."
      : "부정형은 단순히 세게 말하는 게 아니라, 고객이 잃는 것을 구체적으로 보여줘야 합니다.",
  };
}

function scorePS(answer, persona) {
  const text = answer.trim();
  let score = 0;
  const checks = [];
  const hasProblemMarker = /문제|P\s*:|Pain|고민|막히|낮|이탈|안/.test(text);
  const hasSolutionMarker = /해결|S\s*:|Solution|그래서|제안|보여|연결|전환/.test(text);
  const hasPersona = [persona.product, persona.brand, persona.pain, persona.desire]
    .some((word) => text.includes(String(word).slice(0, 4)));
  const hasAction = /상담|문의|구매|저장|클릭|랜딩|CTA|행동/.test(text);
  const enough = text.length >= 35;

  if (hasProblemMarker) score += 6;
  checks.push({ ok: hasProblemMarker, label: "Problem이 먼저 보임" });
  if (hasSolutionMarker) score += 7;
  checks.push({ ok: hasSolutionMarker, label: "Solution이 명확함" });
  if (hasPersona) score += 5;
  checks.push({ ok: hasPersona, label: "페르소나와 제품 맥락을 반영함" });
  if (hasAction) score += 4;
  checks.push({ ok: hasAction, label: "다음 행동/전환이 있음" });
  if (enough) score += 3;
  checks.push({ ok: enough, label: "기획으로 판단할 만큼 충분히 씀" });

  return {
    score: Math.min(25, score),
    checks,
    feedback: score >= 20
      ? "PS 구조가 잘 보입니다. 문제에서 해결로 넘어가는 길이 선명합니다."
      : "PS는 P와 S가 분리되어 보여야 합니다. 문제 한 줄, 해결 한 줄을 더 또렷하게 써보세요.",
  };
}

function gradeAnswer(question, answer, persona) {
  if (question.kind === "writeHook") return scoreHook(answer, persona);
  if (question.kind === "writeStructure") return scorePS(answer, persona);
  const correct = answer === question.answer;
  return {
    score: correct ? question.max : 0,
    checks: [{ ok: correct, label: correct ? "정답입니다" : `정답은 ${question.answer}입니다` }],
    feedback: correct ? "구조를 정확히 봤습니다." : "문장 순서를 다시 보면 힌트가 보입니다.",
  };
}

export default function HookingPracticePage({ onBack }) {
  const [persona, setPersona] = useState(() => pickRandom(PERSONAS));
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [selected, setSelected] = useState("");
  const [history, setHistory] = useState([]);
  const [result, setResult] = useState(null);
  const question = useMemo(() => buildQuestion(persona, questionIndex), [persona, questionIndex]);
  const isChoice = question.kind === "chooseStructure" || question.kind === "chooseHook";
  const total = history.reduce((sum, item) => sum + item.score, 0);
  const maxTotal = history.reduce((sum, item) => sum + item.max, 0);
  const percent = maxTotal ? Math.round((total / maxTotal) * 100) : 0;

  const resetPersona = () => {
    setPersona(pickRandom(PERSONAS));
    setQuestionIndex(0);
    setAnswer("");
    setSelected("");
    setResult(null);
    setHistory([]);
  };

  const submit = () => {
    const value = isChoice ? selected : answer;
    if (!value.trim()) return;
    const graded = gradeAnswer(question, value, persona);
    const next = { ...graded, title: question.title, max: question.max };
    setResult(next);
    setHistory((prev) => [...prev, next]);
  };

  const nextQuestion = () => {
    setQuestionIndex((prev) => prev + 1);
    setAnswer("");
    setSelected("");
    setResult(null);
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
          <button onClick={resetPersona} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">
            새 페르소나
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-5 px-6 py-6 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-4">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.15em] text-orange-500">Random Advertiser</p>
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
                <button onClick={submit} className="rounded-lg bg-gray-950 px-5 py-2 text-sm font-black text-white hover:bg-black">
                  제출
                </button>
              ) : (
                <button onClick={nextQuestion} className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-black text-white hover:bg-orange-600">
                  다음 문제
                </button>
              )}
            </div>
          </div>

          {result && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-black text-gray-950">채점 결과</h3>
                <span className={`rounded-full px-3 py-1 text-sm font-black ${
                  result.score >= 20 ? "bg-green-100 text-green-700" : result.score >= 12 ? "bg-yellow-100 text-yellow-700" : "bg-rose-100 text-rose-700"
                }`}>
                  {result.score}/{result.max}
                </span>
              </div>
              <p className="mb-4 text-sm leading-7 text-gray-700">{result.feedback}</p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {result.checks.map((check) => (
                  <div key={check.label} className={`rounded-lg border px-3 py-2 text-sm ${
                    check.ok ? "border-green-200 bg-green-50 text-green-800" : "border-rose-200 bg-rose-50 text-rose-800"
                  }`}>
                    <span className="font-black">{check.ok ? "OK" : "MISS"}</span> {check.label}
                  </div>
                ))}
              </div>
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
