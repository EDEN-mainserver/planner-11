// 제안서 생성 — Gemini/OpenAI/Claude 직접 호출 (SDK 의존성 없음)
// 한국어/영어 자동 분기, 사이트별 맞춤 제안서 HTML 생성.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const GEMINI_MODELS = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash-lite"];
const OPENAI_MODEL = "gpt-4o-mini";
const ANTHROPIC_MODEL = "claude-sonnet-4-6";

const SYSTEM_KO = `당신은 한국 B2B 콜드메일에서 매출을 만드는 세일즈 카피라이터다.

목표:
상대가 "그냥 제안서구나" 하고 넘기지 못하게, 받은 즉시 읽고 싶어지는 짧고 강한 이메일을 작성한다.

반드시 충족할 것:
- subject는 22~38자. 손실회피/기회비용/매출 기회가 느껴지는 후킹 제목으로 쓴다.
- subject에 "제안서", "자동 생성", "B2B 영업" 같은 설명형 문구를 쓰지 않는다.
- 첫 문장은 상대 사이트/제품/고객 상황을 콕 집고, 바로 문제를 제기한다.
- 본문은 아래 3가지 질문에 답해야 한다.
  1) 왜 지금 이 마케팅을 해야 하는가?
  2) 왜 수많은 대행사 중 에덴이어야 하는가?
  3) 왜 이 퍼널/서비스 상품이어야 하는가?
- "좋습니다", "도와드립니다"가 아니라 놓치면 생기는 손실과 얻을 수 있는 결과를 명확히 쓴다.
- 형식적 인사·과장 금지. "귀사의 무궁한 발전", "최고의 솔루션" 같은 빈말 금지.
- 본문은 5~9문장. 짧은 문단 중심.
- body_html은 <p>, <h2>, <ul>, <li>, <strong>만 사용한다.
- 마지막 CTA는 "15분만 보면 판단 가능"처럼 부담이 낮고 구체적으로 쓴다.

출력 형식 — 반드시 JSON 한 줄만 (다른 텍스트 금지):
{"subject":"메일 제목","body_html":"<p>...</p><p>...</p>","body_text":"평문"}`;

const SYSTEM_EN = `You are a B2B cold email copywriter who writes revenue-focused outreach.

Goal:
Write a short email that creates enough urgency and relevance that the recipient wants to keep reading.

Rules:
- Subject must be 22-45 characters and feel like opportunity cost, revenue upside, or a missed growth channel.
- Do not use generic labels like "proposal", "B2B sales", or "automated proposal" in the subject.
- First sentence must reference a concrete clue from their site and immediately connect it to a business problem.
- The body must answer:
  1) Why this marketing channel now?
  2) Why Eden instead of many other agencies?
  3) Why this funnel/service product?
- Make the cost of ignoring it and the practical outcome clear.
- No generic greetings, no hype, no empty claims.
- 5-9 sentences. Short paragraphs.
- body_html may only use <p>, <h2>, <ul>, <li>, <strong>.
- End with a low-friction CTA.

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

위 정보로 콜드메일 1통을 작성하라.
상대가 이 메일을 안 보면 손해라고 느끼게 하되, 과장 광고처럼 보이면 실패다.
서비스 설명이 "숏폼", "퍼널", "콘텐츠", "광고", "CRM" 중 무엇이든, 왜 지금 필요한지/왜 에덴인지/왜 이 상품인지가 분명해야 한다.
JSON 한 줄만 출력.`;
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

Write one cold email.
Make it clear why ignoring this is costly, why Eden is the better choice, and why this funnel/service product is the right next step.
Output JSON only.`;
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
            maxOutputTokens: 4096,
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
      max_tokens: 2500,
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
      const result = await call({ system, user });
      const parsed = extractJson(result.text);
      if (!parsed || !parsed.subject || !parsed.body_html) {
        throw new Error(`${result.model} 응답 파싱 실패: ${result.text.slice(0, 300)}`);
      }
      return { ...result, parsed };
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
  const { model, parsed } = await generateText({ system, user });

  return {
    subject: parsed.subject,
    body_html: parsed.body_html,
    body_text: parsed.body_text || "",
    language: lang,
    model,
  };
}
