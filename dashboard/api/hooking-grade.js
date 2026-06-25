const GEMINI_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.5-pro"];

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function extractJson(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    // continue
  }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function gradeWithGemini(payload) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.");

  const system = `너는 숏폼 후킹·구조 채점 코치다. 너의 역할은 "격려"가 아니라 정확한 실력 진단이다. 채점만 하지 말고, 사용자가 다음에 더 잘 쓰도록 가르쳐라.

[채점 기준]
- 후킹: 엔진 일치 40 / 페르소나 적합 30 / 완성도 20 / 규칙 준수 10
- 구조: 구조 일치 40 / 페르소나 적합 30 / 흐름 20 / 규칙 준수 10
- 판정: 80+ 통과, 60~79 보완, 60미만 재작성.

[엄격 채점 규칙]
1. 답변이 짧고 범용적이면 절대 60점 이상 주지 않는다. 예: "아직도 일반 케이크 먹나요?"처럼 어떤 문제에도 붙일 수 있는 문장은 페르소나·구조·엔진 증거가 없으면 낮게 채점한다.
2. 구조 문제(mode=structure)에서 단계 전개가 없고 한 줄 후킹만 있으면 최대 35점이다.
3. 구조 문제에서 요구 구조의 핵심 단계가 2개 이상 보이지 않으면 최대 55점이다.
4. 후킹 문제(mode=hook)에서 target.label의 판별 단서가 보이지 않으면 최대 55점이다.
5. 페르소나의 상품, 타겟, 문제, 욕구 중 하나도 반영하지 않으면 최대 50점이다.
6. 정답 목표와 다른 심리 엔진/구조로 보이면 문장이 좋아도 엔진/구조 일치 점수는 15/40 이하로 제한한다.
7. "그럴듯함"이 아니라 payload.target에 얼마나 정확히 맞았는지를 우선한다.

[코칭 원칙]
1. 각 항목은 why(왜 그 점수인지, 답변의 실제 표현 근거)와 how(만점 받으려면 무엇을 고칠지)를 모두 쓴다.
2. 추상적 칭찬 금지. 엔진의 판별 단서, 구조 단계, 증폭기 단위로 짚는다.
3. rewrite는 사용자의 원문을 최소 수정한 개선 버전으로 만든다.
4. model_answers는 서로 다른 각도로 2개 만든다.
5. 과장, 허위, 의료/금융/법률 리스크가 있으면 규칙 준수에서 감점한다.

반드시 JSON만 출력한다.`;

  const user = JSON.stringify(payload);
  const errors = [];
  for (const model of GEMINI_MODELS) {
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                score: { type: "number" },
                subscores: { type: "object" },
                verdict: { type: "string" },
                summary: { type: "string" },
                coaching: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      item: { type: "string" },
                      got: { type: "number" },
                      max: { type: "number" },
                      why: { type: "string" },
                      how: { type: "string" },
                    },
                    required: ["item", "got", "max", "why", "how"],
                  },
                },
                rewrite: {
                  type: "object",
                  properties: {
                    before: { type: "string" },
                    after: { type: "string" },
                    changed: { type: "string" },
                  },
                  required: ["before", "after", "changed"],
                },
                model_answers: { type: "array", items: { type: "string" } },
              },
              required: ["score", "subscores", "verdict", "summary", "coaching", "rewrite", "model_answers"],
            },
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      });
      if (!resp.ok) {
        const raw = await resp.text();
        errors.push(`${model}: ${raw.slice(0, 200)}`);
        continue;
      }
      const data = await resp.json();
      const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
      const parsed = extractJson(text);
      if (!parsed) throw new Error(`${model} JSON 파싱 실패`);
      return normalizeGrading(payload, { ...parsed, model });
    } catch (e) {
      errors.push(`${model}: ${e.message}`);
    }
  }
  throw new Error(errors.join(" | "));
}

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function splitKeywords(...values) {
  const stopwords = new Set([
    "그리고", "하지만", "때문", "위해", "대한", "관련", "고객", "타겟", "상품", "서비스",
    "마케팅", "콘텐츠", "숏폼", "대표", "문제", "욕구", "구매", "전환", "브랜드",
  ]);
  return [...new Set(values
    .join(" ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2 && !stopwords.has(word))
  )];
}

function countMatches(answer, keywords) {
  const normalized = answer.toLowerCase();
  return keywords.filter((word) => normalized.includes(word.toLowerCase())).length;
}

function getCueWords(target, mode) {
  const base = [
    target?.label,
    target?.tell,
    target?.hint,
    ...(target?.examples || []),
  ];
  const byKey = {
    info_gap: ["모르는", "비밀", "공개", "이유", "진짜", "왜"],
    self_reference: ["당신", "대표님", "사장님", "하는 분", "라면", "주목"],
    pattern_interrupt: ["오히려", "반대로", "뜻밖", "의외", "하지 마세요", "틀렸습니다"],
    loss_aversion: ["손해", "날립니다", "잃", "위험", "망", "안 하면", "후회"],
    open_loop: ["마지막", "끝까지", "결과", "공개합니다", "잠시 후"],
    processing_fluency: ["3단계", "정리", "쉽게", "한 줄", "끝냅니다"],
    escalating_reward: ["첫째", "둘째", "마지막", "더", "핵심"],
    tension_curve: ["될까요", "과연", "도전", "성공", "실패"],
    peak_end: ["마지막", "엔딩", "결정", "한마디", "반전"],
    narrative_transport: ["사실", "처음", "그날", "이야기", "겪"],
    authority: ["전문가", "현직", "경력", "년차", "데이터"],
    vulnerability: ["솔직히", "실패", "망했", "틀렸", "고백"],
    social_proof: ["요즘", "다들", "후기", "많은", "난리"],
    identification: ["POV", "이런 적", "나도", "공감", "하셨죠"],
    reciprocity: ["무료", "공개", "드림", "알려드림", "그냥"],
    consistency: ["맞죠", "한 번쯤", "이미", "저장", "동의"],
    scarcity: ["오늘", "마감", "한정", "선착순", "이번 달"],
    liking: ["친구", "솔직히", "믿고", "쉽게", "편하게"],
    anchoring: ["보다", "대신", "비교", "원래", "만원", "배"],
    friction_removal: ["클릭", "복붙", "한 번", "바로", "끝"],
    amp_specificity: ["가지", "일", "%", "명", "초", "분"],
    amp_secondperson: ["당신", "대표님", "사장님", "라면", "분들"],
    amp_timecompression: ["초", "분", "하루", "단", "만에"],
    growth_narrative: ["과거", "문제", "위기", "해결", "성공"],
    self_intro: ["예전", "계기", "깨달", "변화", "사명"],
    big_dream: ["목표", "꿈", "도전", "과연", "바꾸"],
    adversity: ["의심", "투쟁", "전환점", "극복", "해냈"],
    breakthrough: ["문제", "발견", "해결책", "결과", "CTA"],
    lesson: ["좌절", "고통", "해결", "교훈", "배웠"],
    listicle: ["가지", "첫째", "둘째", "셋째", "마지막"],
    tutorial: ["1단계", "2단계", "3단계", "따라", "완성"],
    myth_bust: ["통념", "아닙니다", "반박", "진실", "오해"],
    versus: ["vs", "비교", "차이", "전후", "A", "B"],
    twist: ["그런데", "하지만", "반전", "알고 보니", "사실"],
    challenge: ["도전", "일 동안", "해봤", "결과", "과정"],
    reveal: ["비밀", "폭로", "공개", "모르는", "진짜"],
    qna: ["Q", "A", "질문", "답", "?"],
    day_routine: ["하루", "아침", "점심", "저녁", "루틴"],
  };
  return splitKeywords(...base, ...(byKey[target?.key] || []), mode);
}

function applyCap(current, cap, reason, notes) {
  if (current > cap) {
    notes.push(reason);
    return cap;
  }
  return current;
}

function normalizeGrading(payload, result) {
  const answer = compactText(payload.answer);
  const persona = payload.persona || {};
  const target = payload.target || {};
  const notes = [];
  let score = Math.max(0, Math.min(100, Number(result.score || 0)));
  const personaKeywords = splitKeywords(
    persona.brand,
    persona.product,
    persona.audience,
    persona.pain,
    persona.desire,
    persona.objection,
  );
  const personaMatches = countMatches(answer, personaKeywords);
  const cueMatches = countMatches(answer, getCueWords(target, payload.mode));
  const sentenceLikeParts = answer.split(/[\n.!?。！？]|->|→|[0-9]\s*[.)]|첫째|둘째|셋째|마지막/g).filter((part) => compactText(part).length >= 4).length;
  const veryShort = answer.length < 18;
  const short = answer.length < 45;

  if (veryShort) {
    score = applyCap(score, 35, "답변이 너무 짧아 목표 의도와 페르소나 반영을 검증하기 어렵습니다.", notes);
  } else if (short) {
    score = applyCap(score, 60, "짧은 범용 문장이라 문제별 요구사항을 충분히 수행하지 못했습니다.", notes);
  }

  if (personaMatches === 0) {
    score = applyCap(score, 50, "페르소나의 상품·타겟·문제·욕구가 답변에 직접 반영되지 않았습니다.", notes);
  }

  if (cueMatches === 0) {
    score = applyCap(score, 55, `${target.label || "목표"}의 판별 단서가 답변에 보이지 않습니다.`, notes);
  }

  if (payload.mode === "structure") {
    if (answer.length < 70 || sentenceLikeParts < 3) {
      score = applyCap(score, 35, "구조 문제인데 단계 전개 없이 한 줄 후킹에 가깝습니다.", notes);
    } else if (sentenceLikeParts < 4) {
      score = applyCap(score, 55, "요구 구조의 핵심 단계가 충분히 분리되어 보이지 않습니다.", notes);
    }
  }

  const roundedScore = Math.round(score);
  const verdict = roundedScore >= 80 ? "통과" : roundedScore >= 60 ? "보완" : "재작성";
  const penaltySummary = notes.length ? ` 엄격 기준 감점: ${notes.join(" ")}` : "";
  const coaching = Array.isArray(result.coaching) ? [...result.coaching] : [];
  if (notes.length) {
    coaching.unshift({
      item: "엄격 기준",
      got: roundedScore,
      max: 100,
      why: notes.join(" "),
      how: "문제에서 요구한 엔진/구조 단서를 먼저 넣고, 광고주의 상품·타겟·문제·욕구 중 최소 2개 이상을 문장에 직접 반영하세요.",
    });
  }

  return {
    ...result,
    score: roundedScore,
    verdict,
    summary: `${result.summary || ""}${penaltySummary}`.trim(),
    coaching,
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const { persona, target, answer, mode } = req.body || {};
    if (!persona || !target || !answer || !mode) {
      return res.status(400).json({ error: "persona, target, answer, mode가 필요합니다." });
    }
    const result = await gradeWithGemini({ persona, target, answer, mode });
    return res.status(200).json({ result });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
