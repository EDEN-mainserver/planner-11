import { callGemini } from "../../utils/gemini";

export function extractJsonObject(raw) {
  const text = String(raw || "").trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : "";
}

// 모델 응답을 normalize. 자르지 않고 문장 끝 보존이 우선.
// 매우 비정상적으로 긴 경우(예: 모델이 1000자 넘게 응답)에만 안전선 cutoff.
// 일반 길이는 그대로 통과 — 사용자가 인라인 편집으로 다듬도록.
const SAFE_HEADLINE_MAX = 100;
const SAFE_BODY_MAX = 1000;

export function normalizePlanData(planData) {
  const slides = Array.isArray(planData?.slides) ? planData.slides : [];
  // 비정상적으로 긴 경우만 마지막 공백 기준으로 자름 (단어 중간 자르기 방지).
  const safeCap = (value, maxLen) => {
    const text = String(value || "").trim();
    if (!text || text.length <= maxLen) return text;
    const cut = text.slice(0, maxLen);
    const lastSpace = cut.lastIndexOf(" ");
    return lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut;
  };
  return {
    ...planData,
    type: planData?.type || "카드뉴스",
    slides: slides.map((slide, i) => {
      const bodyLines = Array.isArray(slide.bodyLines)
        ? slide.bodyLines.map((line) => String(line || "").trim()).filter(Boolean)
        : [];
      const rawBody = bodyLines.length ? bodyLines.join("\n") : (slide.body || "");
      return {
        ...slide,
        num: Number(slide.num) || i + 1,
        part: slide.part || (i === 0 ? "도입" : i === slides.length - 1 ? "마무리" : "본문"),
        headline: safeCap(slide.headline, SAFE_HEADLINE_MAX),
        bodyLines,
        body: safeCap(rawBody, SAFE_BODY_MAX),
        imagePrompt: String(slide.imagePrompt || "").trim(),
      };
    }),
  };
}

export async function parsePlanningJson(raw) {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) throw new Error("기획서 파싱 실패 - JSON 응답이 없습니다. 다시 시도해주세요.");

  try {
    return normalizePlanData(JSON.parse(jsonText));
  } catch (firstError) {
    const repaired = await callGemini(
      [
        {
          role: "user",
          content: `다음 텍스트를 유효한 JSON으로 고쳐줘. 설명 없이 JSON만 반환해.\n\n${jsonText}`,
        },
      ],
      "JSON 복구 전문가. 유효한 JSON만 반환합니다."
    );
    const repairedJson = extractJsonObject(repaired);
    try {
      return normalizePlanData(JSON.parse(repairedJson));
    } catch {
      throw new Error(`기획서 JSON 파싱 실패: ${firstError.message}`);
    }
  }
}

export async function runPlanning(topic, research, slideCount, tone, purpose, brandName, customInstructions = "") {
  const customBlock = String(customInstructions || "").trim()
    ? `\n\n사용자 추가 지시사항(최우선 반영):\n${String(customInstructions).trim()}`
    : "";
  const raw = await callGemini(
    [
      {
        role: "user",
        content: `주제: "${topic}" | 브랜드: ${brandName || "브랜드"} | 톤: ${tone} | 목적: ${purpose}
리서치 요약:
${research}${customBlock}

${slideCount}장 카드뉴스 기획서를 JSON으로 작성해줘:
{
  "type": "나열형|스토리텔링형|집중형|문답형",
  "slides": [
    {
      "num": 1,
      "part": "표지|본문|마무리",
      "headline": "표지(part=표지)는 반드시 두 부분으로 작성: 첫 줄은 짧은 후크 문장(질문형/공감형, 1줄·15~25자), 줄바꿈(\\n), 둘째 줄은 메인 카피(단정형/약속형, **반드시 22자 이하, 2줄 이내에 의미가 완결**되어야 함. 22자 넘으면 짧게 다듬어서 짧게 끝낼 것). 본문·마무리는 한 문장 카피 1~1.5문장(30~55자). 모두 타겟의 결핍을 자극. 단어 중간 자르기 금지. 예시: \"지금 클로드, 아직도 질문만 던지세요?\\n클로드 과외 기능, 따로 있습니다\"",
      "body": "본문 단락. 표지/마무리는 2~3문장의 자연스러운 단락. 본문 슬라이드는 줄바꿈(\\n)으로 4~6개 항목. 각 항목은 마침표·물음표·느낌표로 끝나는 완결된 한 문장. 결핍→공감→해결책 흐름. 한 줄 20~40자, 전체 150~280자",
      "imagePrompt": "영어로 이미지 설명, 사실적 사진 스타일, no text, no watermark, 인스타 카드뉴스 배경용 (1080x1350)"
    }
  ]
}

타겟 페르소나의 결핍을 직접 자극하는 카피 톤 (필수):
- 시간 결핍 ("매번 N시간 쓰던 분"), 돈 결핍 ("월 N달러 내고 계신가요"), 지식 결핍 ("아직 모르고 계신…"),
  자존감 결핍 ("뒤처지고 있다는 불안"), 기회 결핍 ("아직 늦지 않았습니다") 중 주제에 맞는 결핍 1~2개를 슬라이드마다 자극.
- 표지 헤드라인은 결핍을 가장 강하게 건드리는 후크 문장. 일반론·당위론·개론 금지.
- 본문은 결핍 인지 → 공감 → 해결책/증거 → 결과 흐름으로 전개.
- 마지막 슬라이드(part="마무리")는 결핍의 해결책으로 명확한 행동 촉구. "다음 편에·곧 공개·기대해주세요" 같은 예고 표현 금지.

표현 엄수:
- 모든 문장은 마침표·물음표·느낌표로 마무리되는 완결된 문장. 말줄임표(…)나 어절 중간 자르기 금지.
- 단어 중간 끊기 금지. 예: "스크립…" (X) → "스크립트의 힘" (O).
- imagePrompt는 글자 없는 분위기 이미지. 카드 디자인 배경용.

JSON만 반환.`,
      },
    ],
    "카드뉴스 기획 전문가. JSON만 반환합니다."
  );
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("기획서 파싱 실패 — 다시 시도해주세요");
  return parsePlanningJson(raw);
}
