// 제안서 생성 — Gemini/OpenAI/Claude 직접 호출 (SDK 의존성 없음)
// 한국어/영어 자동 분기, 사이트별 맞춤 제안서 HTML 생성.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const GEMINI_MODELS = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash-lite"];
const OPENAI_MODEL = "gpt-4o-mini";
const ANTHROPIC_MODEL = "claude-sonnet-4-6";

const SYSTEM_KO = `당신은 콜드 아웃리치 전문 카피라이터다.

상대 회사의 웹사이트 정보와 우리 회사 정보를 받아서, 진정성 있고 구체적인 협업 제안 이메일을 작성한다.

원칙:
- 첫 문장에서 상대 회사의 구체적인 것(브랜드명·제품·강점)을 언급해 "정말 우리 사이트를 봤구나" 느낌
- 형식적 인사·과장 금지 (귀사의 무궁한 발전을... 같은 표현 X)
- 우리가 도울 수 있는 구체적인 1가지에 집중
- 본문 4~7문장
- 마지막에 가벼운 CTA (15분 통화 / 자료 첨부 등)

출력 형식 — 반드시 JSON 한 줄만 (다른 텍스트 금지):
{"subject":"메일 제목","body_html":"<p>...</p><p>...</p>","body_text":"평문"}`;

const SYSTEM_EN = `You are a cold outreach copywriter.

Receive recipient company info + our company info, write a sincere, specific collaboration proposal email.

Principles:
- Open by referencing something concrete on their site (brand, product, recent move)
- No bragging, no generic greetings ("I hope this finds you well" 금지)
- Focus on ONE concrete way we can help
- 4–7 sentences body
- End with light CTA

Output (MUST be a single-line JSON, no other text):
{"subject":"...","body_html":"<p>...</p>","body_text":"..."}`;


function buildUserPrompt({ recipient, sender, lang }) {
  const r = recipient;
  const s = sender;
  if (lang === "ko") {
    return `## 받는 회사
- 상호: ${r.brand_name || r.domain}
- 사이트: ${r.homepage_url || ("https://" + r.domain)}
- 키워드 발견 경로: ${r.source_keyword || "(미상)"}
- 홈페이지 분석 단서:
${r.summary || "(별도 요약 없음 — 상호, 사이트 주소, 키워드 단서만 사용)"}

## 우리(보내는 회사) 정보
- 회사명/상호: ${s.company_name || "(미입력)"}
- 보내는 사람: ${s.sender_name || "(미입력)"}
- 서비스 설명: ${s.service_description || "(미입력)"}

위 정보로 협업 제안 이메일 1통을 작성하라. JSON 한 줄만 출력.`;
  }
  return `## Recipient
- Brand: ${r.brand_name || r.domain}
- URL: ${r.homepage_url || ("https://" + r.domain)}
- Found via keyword: ${r.source_keyword || "(unknown)"}
- Website clues:
${r.summary || "(No extra summary. Use brand, URL, and keyword clues only.)"}

## Sender
- Company: ${s.company_name || "(blank)"}
- Sender name: ${s.sender_name || "(blank)"}
- Service description: ${s.service_description || "(blank)"}

Write one collaboration proposal email. Output JSON only.`;
}


function extractJson(text) {
  if (!text) return null;
  let s = text.trim();
  // 코드펜스 제거
  const fence = s.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (fence) s = fence[1];
  // 첫 { ~ 마지막 }
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start < 0 || end < 0) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    return null;
  }
}


async function callGemini({ system, user }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY 환경변수가 설정되지 않았습니다");

  const errors = [];
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1600,
            responseMimeType: "application/json",
          },
        }),
      });
      if (!res.ok) {
        const raw = await res.text();
        errors.push(`${model}: ${raw.slice(0, 220)}`);
        if (res.status !== 429 && res.status !== 503) break;
        continue;
      }
      const data = await res.json();
      const text = (data.candidates?.[0]?.content?.parts || [])
        .map((p) => p.text || "")
        .join("")
        .trim();
      if (text) return { text, model };
      errors.push(`${model}: empty response`);
    } catch (e) {
      errors.push(`${model}: ${e.message}`);
    }
  }
  throw new Error(`Gemini 실패: ${errors.join(" | ")}`);
}


async function callOpenAI({ system, user }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY 환경변수가 설정되지 않았습니다");

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API ${res.status}: ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  return {
    text: data.choices?.[0]?.message?.content || "",
    model: OPENAI_MODEL,
  };
}


async function callClaude({ system, user }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다");

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1500,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API ${res.status}: ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  return {
    text: (data.content || []).map((b) => b.text || "").join(""),
    model: ANTHROPIC_MODEL,
  };
}


async function generateText({ system, user }) {
  const errors = [];
  for (const call of [callGemini, callOpenAI, callClaude]) {
    try {
      return await call({ system, user });
    } catch (e) {
      errors.push(e.message);
    }
  }
  throw new Error(`모든 AI 모델 실패: ${errors.join(" / ")}`);
}


// 1개 제안서 생성
export async function generateOne({ recipient, sender }) {
  const lang = recipient.language === "en" ? "en" : "ko";
  const system = lang === "ko" ? SYSTEM_KO : SYSTEM_EN;
  const user = buildUserPrompt({ recipient, sender, lang });
  const { text, model } = await generateText({ system, user });
  const parsed = extractJson(text);
  if (!parsed || !parsed.subject || !parsed.body_html) {
    throw new Error(`AI 응답 파싱 실패: ${text.slice(0, 300)}`);
  }

  return {
    subject: parsed.subject,
    body_html: parsed.body_html,
    body_text: parsed.body_text || "",
    language: lang,
    model,
  };
}
