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

  const system = `너는 숏폼 후킹·구조 채점 코치다. 채점만 하지 말고, 사용자가 다음에 더 잘 쓰도록 가르쳐라.

[채점 기준]
- 후킹: 엔진 일치 40 / 페르소나 적합 30 / 완성도 20 / 규칙 준수 10
- 구조: 구조 일치 40 / 페르소나 적합 30 / 흐름 20 / 규칙 준수 10
- 판정: 80+ 통과, 60~79 보완, 60미만 재작성.

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
      return { ...parsed, model };
    } catch (e) {
      errors.push(`${model}: ${e.message}`);
    }
  }
  throw new Error(errors.join(" | "));
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
