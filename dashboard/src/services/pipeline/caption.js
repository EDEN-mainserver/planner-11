import { callGemini } from "../../utils/gemini";
import { loadLocalText, saveLocalText } from "./socialStorage";

export const DEFAULT_CAPTION_PROMPT =
  '기획을 바탕으로 인스타그램 게시용 캡션을 작성해줘. 첫 문장은 "기획의 핵심 키워드를 넣으면 자료 준다고 해줘.", 본문은 2~4문장으로 자연스럽게 풀어 쓰고, 마지막에는 관련 해시태그 5개를 붙여줘.';

export const captionPromptKey = (username) => `eden_caption_prompt_${username}_v1`;

function formatCardLines(cards, plan, { dropEmpty = true } = {}) {
  const sourceCards = cards.length > 0 ? cards : plan?.slides || [];
  const lines = sourceCards.map((card, i) => {
    const headline = String(card.headline || "").trim();
    const body = String(card.body || "").trim().replace(/\n+/g, " | ");
    return `${i + 1}. ${headline}${body ? ` / ${body}` : ""}`;
  });
  return (dropEmpty ? lines.filter(Boolean) : lines).join("\n");
}

export function buildCaptionContext({ topic, brandName, tone, purpose, research, cards, plan }) {
  const cardLines = formatCardLines(cards, plan);
  const researchText = String(research || "").trim();
  return [
    `주제: ${topic || ""}`,
    `브랜드: ${brandName || "브랜드"}`,
    `톤: ${tone}`,
    `목적: ${purpose}`,
    researchText ? `리서치 요약:\n${researchText}` : "",
    cardLines ? `카드 요약:\n${cardLines}` : "",
  ].filter(Boolean).join("\n\n");
}

// localStorage에 저장된 캡션 프롬프트를 읽어 돌려준다 (없으면 기본 프롬프트).
export function loadCaptionPrompt(username) {
  const safeUsername = username || "__guest";
  return loadLocalText(captionPromptKey(safeUsername)) || DEFAULT_CAPTION_PROMPT;
}

// 캡션 프롬프트를 localStorage에 저장하고 정규화된 값을 돌려준다.
export function persistCaptionPrompt(username, captionPrompt) {
  const safeUsername = username || "__guest";
  const nextPrompt = String(captionPrompt || "").trim() || DEFAULT_CAPTION_PROMPT;
  saveLocalText(captionPromptKey(safeUsername), nextPrompt);
  return nextPrompt;
}

// 프롬프트 + 컨텍스트를 채워 Gemini를 호출하고 캡션 본문만 돌려준다.
export async function generateCaption({
  topic,
  brandName,
  tone,
  purpose,
  research,
  cards,
  plan,
  captionPrompt,
}) {
  if (!String(topic || "").trim()) {
    throw new Error("캡션을 만들 주제를 먼저 입력해주세요");
  }

  const cardLines = formatCardLines(cards, plan, { dropEmpty: false });
  const rawPrompt = String(captionPrompt || "").trim() || DEFAULT_CAPTION_PROMPT;
  const filledPrompt = rawPrompt
    .replaceAll("{topic}", topic || "")
    .replaceAll("{brand}", brandName || "브랜드")
    .replaceAll("{tone}", tone || "")
    .replaceAll("{purpose}", purpose || "")
    .replaceAll("{research}", String(research || "").trim())
    .replaceAll("{cards}", cardLines);

  const context = buildCaptionContext({ topic, brandName, tone, purpose, research, cards, plan });

  const result = await callGemini(
    [
      {
        role: "user",
        content: `아래 캡션 작성 지시를 가장 우선으로 따르고, 문맥을 참고해 게시용 캡션만 작성해줘.
추가 설명, 머리말, 따옴표, 코드블록 없이 캡션 본문만 출력해.
줄바꿈과 해시태그는 지시에 맞게 자연스럽게 포함해.

캡션 작성 지시:
${filledPrompt}

문맥:
${context}`,
      },
    ],
    "SNS 게시용 캡션 카피라이터. 사용자의 스타일 지시를 최우선으로 따르고, 결과물만 출력합니다."
  );

  return String(result || "").trim();
}
