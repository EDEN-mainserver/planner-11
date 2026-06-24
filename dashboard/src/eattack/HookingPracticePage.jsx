import { useMemo, useState } from "react";

const MODES = [
  {
    key: "loss",
    label: "손실회피",
    tone: "놓치면 손해",
    color: "bg-rose-50 text-rose-700 border-rose-200",
  },
  {
    key: "why",
    label: "왜 지금",
    tone: "지금 해야 할 이유",
    color: "bg-orange-50 text-orange-700 border-orange-200",
  },
  {
    key: "eden",
    label: "왜 에덴",
    tone: "대행사 차별화",
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    key: "funnel",
    label: "왜 이 상품",
    tone: "상품 선택 이유",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
];

const DEFAULTS = {
  service: "숏폼 퍼널 상품",
  target: "매출을 더 만들고 싶은 브랜드 대표",
  pain: "조회수는 나오는데 문의와 구매로 이어지지 않는 문제",
  proof: "기획, 촬영, 편집, 랜딩, 리마케팅까지 한 흐름으로 연결",
};

function clean(value, fallback) {
  const text = String(value || "").trim();
  return text || fallback;
}

function buildScripts({ service, target, pain, proof, mode }) {
  const s = clean(service, DEFAULTS.service);
  const t = clean(target, DEFAULTS.target);
  const p = clean(pain, DEFAULTS.pain);
  const r = clean(proof, DEFAULTS.proof);

  const bank = {
    loss: [
      {
        hook: `${s}을 안 하는 게 문제가 아니라, 고객이 경쟁사 숏폼에서 먼저 설득되는 게 문제입니다.`,
        bridge: `${t}는 이미 광고를 보고 사지 않습니다. 짧은 영상에서 신뢰를 먼저 확인하고, 그 다음 검색하고, 마지막에 문의합니다.`,
        structure: [`${p}를 첫 3초에 꺼낸다`, "고객이 놓치는 비용을 보여준다", `${r}로 해결 흐름을 제시한다`],
        close: "오늘 찍을 영상 1개보다, 다음 문의를 만드는 흐름 1개가 더 중요합니다.",
      },
      {
        hook: `지금 숏폼을 미루면, 고객의 첫 비교 후보에서 빠집니다.`,
        bridge: `${s}은 조회수 놀이가 아니라 고객의 첫 기억을 선점하는 장치입니다.`,
        structure: ["고객의 현재 행동을 짚는다", "미루면 생기는 손실을 말한다", "에덴의 퍼널형 실행을 제안한다"],
        close: "보는 사람을 남기는 영상이 아니라, 움직이는 사람을 만드는 영상이어야 합니다.",
      },
    ],
    why: [
      {
        hook: `왜 지금 ${s}이어야 할까요? 고객의 검색 순서가 바뀌었기 때문입니다.`,
        bridge: `${t}는 더 이상 상세페이지부터 보지 않습니다. 짧은 콘텐츠로 감을 잡고, 믿을 만하면 깊게 들어옵니다.`,
        structure: ["시장 변화 한 줄", "고객 행동 변화 한 줄", "지금 시작해야 하는 이유 한 줄"],
        close: "늦게 시작하면 영상 제작비보다 고객 설득 비용이 더 커집니다.",
      },
      {
        hook: `긴 설명을 보기 전에, 고객은 이미 짧은 영상으로 결론을 냅니다.`,
        bridge: `${p}가 있다면 문제는 콘텐츠 양이 아니라 설득 순서입니다.`,
        structure: ["고객이 지나치는 이유", "첫 3초 후킹", "저장과 문의로 이어지는 끝 구조"],
        close: "숏폼은 유행이 아니라 구매 전 검증 단계가 됐습니다.",
      },
    ],
    eden: [
      {
        hook: `에덴은 영상을 예쁘게 만드는 팀이 아니라, 고객이 넘어오는 길을 설계합니다.`,
        bridge: `많은 대행사가 업로드에서 끝나지만, ${s}은 업로드 이후의 클릭, 문의, 재접촉까지 봐야 합니다.`,
        structure: ["후킹으로 멈추게 한다", "구조로 납득시킨다", "끝 문장으로 다음 행동을 만든다"],
        close: `${r}. 그래서 단발 콘텐츠가 아니라 매출 흐름으로 봅니다.`,
      },
      {
        hook: `대행사는 많지만, 숏폼을 퍼널로 보는 팀은 많지 않습니다.`,
        bridge: `${t}에게 필요한 건 영상 개수가 아니라 고객이 왜 지금 사야 하는지 납득하는 구조입니다.`,
        structure: ["제품 니즈 진단", "콘텐츠 각도 설계", "전환 지점 연결"],
        close: "에덴은 조회수보다 다음 행동을 먼저 설계합니다.",
      },
    ],
    funnel: [
      {
        hook: `${s}을 고르는 이유는 단순합니다. 한 번 본 고객을 그냥 놓치지 않기 위해서입니다.`,
        bridge: `숏폼 하나가 터져도 ${p}가 남으면 매출은 쌓이지 않습니다.`,
        structure: ["첫 영상에서 문제 인식", "반복 콘텐츠로 신뢰 형성", "랜딩과 리마케팅으로 전환"],
        close: "콘텐츠를 비용으로 끝내지 않고 자산으로 남기는 구조가 필요합니다.",
      },
      {
        hook: `영상만 만들면 조회수에서 끝나고, 퍼널로 만들면 고객 데이터가 남습니다.`,
        bridge: `${t}에게 필요한 건 바이럴 하나가 아니라 다음 달에도 재사용할 수 있는 설득 구조입니다.`,
        structure: ["고객의 니즈를 쪼갠다", "각 니즈별 후킹을 만든다", "문의로 이어지는 끝 문장을 붙인다"],
        close: "그래서 숏폼은 제작 상품이 아니라 퍼널 상품으로 팔아야 합니다.",
      },
    ],
  };

  return bank[mode] || bank.loss;
}

export default function HookingPracticePage({ onBack }) {
  const [mode, setMode] = useState("loss");
  const [fields, setFields] = useState(DEFAULTS);
  const [selected, setSelected] = useState(0);
  const scripts = useMemo(() => buildScripts({ ...fields, mode }), [fields, mode]);
  const current = scripts[selected] || scripts[0];

  const updateField = (key, value) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const copyScript = async () => {
    const text = [
      `[후킹] ${current.hook}`,
      `[구조] ${current.bridge}`,
      ...current.structure.map((item, i) => `${i + 1}. ${item}`),
      `[끝] ${current.close}`,
    ].join("\n");
    await navigator.clipboard?.writeText(text);
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-[#f7f8fb]">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white/95 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
            aria-label="뒤로가기"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-black tracking-tight text-gray-950">후킹끝구조끝</h1>
            <p className="text-xs text-gray-500">숏폼 첫 문장, 설득 구조, 마지막 행동 유도 연습</p>
          </div>
        </div>
        <button
          onClick={copyScript}
          className="rounded-lg bg-gray-950 px-4 py-2 text-sm font-bold text-white hover:bg-black"
        >
          복사
        </button>
      </div>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-5 px-6 py-6 lg:grid-cols-[360px_1fr]">
        <section className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-black text-gray-900">연습 입력</h2>
            {[
              ["service", "팔고 싶은 서비스", "예: 숏폼 퍼널 상품"],
              ["target", "누구에게 말하나요?", "예: 매출을 더 만들고 싶은 브랜드 대표"],
              ["pain", "상대의 문제", "예: 조회수는 있는데 문의가 없음"],
              ["proof", "에덴의 차별점", "예: 기획부터 리마케팅까지 연결"],
            ].map(([key, label, placeholder]) => (
              <label key={key} className="mb-3 block">
                <span className="mb-1 block text-[11px] font-bold text-gray-500">{label}</span>
                <textarea
                  value={fields[key]}
                  onChange={(e) => updateField(key, e.target.value)}
                  placeholder={placeholder}
                  rows={key === "pain" || key === "proof" ? 3 : 2}
                  className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100"
                />
              </label>
            ))}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-black text-gray-900">연습 모드</h2>
            <div className="grid grid-cols-2 gap-2">
              {MODES.map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    setMode(item.key);
                    setSelected(0);
                  }}
                  className={`rounded-lg border px-3 py-2 text-left text-xs font-bold transition ${
                    mode === item.key ? item.color : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span className="block text-sm">{item.label}</span>
                  <span className="font-medium opacity-70">{item.tone}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-gray-900 bg-gray-950 p-5 text-white shadow-xl">
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-orange-300">Short-form Drill</p>
            <h2 className="max-w-3xl text-3xl font-black leading-tight tracking-tight">{current.hook}</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-300">{current.bridge}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-black text-gray-900">후킹 끝, 구조 끝</h3>
                <span className="rounded-full bg-orange-100 px-3 py-1 text-[11px] font-bold text-orange-700">
                  {MODES.find((m) => m.key === mode)?.label}
                </span>
              </div>

              <div className="space-y-3">
                <Block label="후킹" value={current.hook} strong />
                <Block label="구조" value={current.bridge} />
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="mb-3 text-[11px] font-black text-gray-500">3단 전개</p>
                  <div className="space-y-2">
                    {current.structure.map((item, i) => (
                      <div key={item} className="flex gap-3 rounded-lg bg-white p-3 text-sm text-gray-800">
                        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-950 text-xs font-black text-white">
                          {i + 1}
                        </span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <Block label="끝" value={current.close} strong />
              </div>
            </div>

            <aside className="space-y-3">
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-sm font-black text-gray-900">예시 선택</h3>
                <div className="space-y-2">
                  {scripts.map((script, index) => (
                    <button
                      key={script.hook}
                      onClick={() => setSelected(index)}
                      className={`w-full rounded-lg border p-3 text-left text-xs transition ${
                        selected === index
                          ? "border-orange-300 bg-orange-50 text-orange-900"
                          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <span className="mb-1 block font-black">예시 {index + 1}</span>
                      <span className="line-clamp-2 leading-5">{script.hook}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4 text-xs leading-6 text-gray-600 shadow-sm">
                <p className="font-black text-gray-900">연습 규칙</p>
                <p>첫 문장은 멈추게 하고, 중간은 납득시키고, 마지막은 행동하게 만듭니다.</p>
                <p className="mt-2 font-bold text-orange-700">후킹 끝. 구조 끝. 다음 행동까지 끝.</p>
              </div>
            </aside>
          </div>
        </section>
      </main>
    </div>
  );
}

function Block({ label, value, strong = false }) {
  return (
    <div className={`rounded-xl border p-4 ${strong ? "border-orange-200 bg-orange-50" : "border-gray-200 bg-white"}`}>
      <p className={`mb-1 text-[11px] font-black ${strong ? "text-orange-700" : "text-gray-500"}`}>{label}</p>
      <p className={`text-sm leading-7 ${strong ? "font-bold text-gray-950" : "text-gray-700"}`}>{value}</p>
    </div>
  );
}
