const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash-lite"];

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function extractJson(text) {
  const raw = String(text || "").trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

function fingerprint(persona) {
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

async function callGemini({ used = [] }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.");

  const system = `당신은 숏폼 마케팅 훈련용 광고주 페르소나 생성기다.
매번 실제 있을 법하지만 가상의 광고주를 만든다.
중요: 이전에 나온 광고주와 브랜드명, 업종, 상품, 타겟, 문제 상황이 겹치면 실패다.
너무 일반적인 "뷰티 브랜드", "헬스 코치"만 반복하지 말고 산업을 넓게 섞어라.
예: 로컬 병원, B2B SaaS, 프랜차이즈, 학원, 식품, 숙박, 세무, 펫, 실버케어, 웨딩, 인테리어, 공방, 농산물, 법률, 중고차, 이커머스, 교육, 앱 서비스 등.
한국어로 작성하라.
출력은 JSON 한 줄만 한다.`;

  const user = `이미 나온 페르소나 지문:
${used.slice(-80).map((v, i) => `${i + 1}. ${v}`).join("\n") || "(없음)"}

새 광고주 페르소나 1개를 생성하라.
조건:
- brand: 실제 브랜드처럼 보이지만 가상의 2~5글자 상호
- owner: 광고주 유형과 경력/상황
- product: 구체적인 서비스 또는 상품
- audience: 구매자 타겟의 상황과 감정
- pain: 현재 마케팅/판매 문제
- desire: 숏폼으로 얻고 싶은 변화
- objection: 숏폼/퍼널 구매 전 망설임

JSON 스키마:
{"brand":"","owner":"","product":"","audience":"","pain":"","desire":"","objection":""}`;

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
            temperature: 1.05,
            maxOutputTokens: 1200,
            responseMimeType: "application/json",
          },
        }),
      });
      if (!resp.ok) {
        const raw = await resp.text();
        errors.push(`${model}: ${raw.slice(0, 180)}`);
        continue;
      }
      const data = await resp.json();
      const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
      const persona = extractJson(text);
      if (!persona) throw new Error(`${model} JSON 파싱 실패`);
      for (const key of ["brand", "owner", "product", "audience", "pain", "desire", "objection"]) {
        if (!persona[key]) throw new Error(`${model} ${key} 누락`);
      }
      return { ...persona, fingerprint: fingerprint(persona), model };
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
    const used = Array.isArray(req.body?.used) ? req.body.used : [];
    const persona = await callGemini({ used });
    return res.status(200).json({ persona });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
