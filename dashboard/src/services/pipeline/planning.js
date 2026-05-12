import { callGemini } from "../../utils/gemini";

export function extractJsonObject(raw) {
  const text = String(raw || "").trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : "";
}

export function normalizePlanData(planData) {
  const slides = Array.isArray(planData?.slides) ? planData.slides : [];
  const shortenText = (value, maxLen) => {
    const text = String(value || "").trim().replace(/\s+/g, " ");
    if (!text) return "";
    if (text.length <= maxLen) return text;
    return `${text.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
  };
  const shortenLines = (value, maxLenPerLine, maxLines, maxTotalLen) => {
    const lines = String(value || "")
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, maxLines);
    if (!lines.length) return "";
    const trimmed = [];
    let total = 0;
    for (const line of lines) {
      let next = shortenText(line, maxLenPerLine);
      if (total + next.length > maxTotalLen) {
        const remain = Math.max(0, maxTotalLen - total);
        if (remain <= 1) break;
        next = shortenText(next, remain);
      }
      trimmed.push(next);
      total += next.length;
      if (total >= maxTotalLen) break;
    }
    return trimmed.join("\n");
  };
  return {
    ...planData,
    type: planData?.type || "카드뉴스",
    slides: slides.map((slide, i) => {
      const bodyLines = Array.isArray(slide.bodyLines)
        ? slide.bodyLines.map((line) => String(line || "").trim()).filter(Boolean)
        : [];
      return {
        ...slide,
        num: Number(slide.num) || i + 1,
        part: slide.part || (i === 0 ? "도입" : i === slides.length - 1 ? "마무리" : "본문"),
        headline: shortenText(slide.headline, 12),
        bodyLines,
        body: shortenLines(bodyLines.length ? bodyLines.join("\n") : slide.body, 16, 4, 64),
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

export async function runPlanning(topic, research, slideCount, tone, purpose, brandName) {
  const raw = await callGemini(
    [
      {
        role: "user",
        content: `주제: "${topic}" | 브랜드: ${brandName || "브랜드"} | 톤: ${tone} | 목적: ${purpose}
리서치 요약:
${research}

${slideCount}장 카드뉴스 기획서를 JSON으로 작성해줘:
{
  "type": "나열형|스토리텔링형|집중형|문답형",
  "slides": [
    {
      "num": 1,
      "part": "표지|본문|마무리",
      "headline": "제목(한 줄, 10~12자 이내)",
      "body": "본문 — 표지/마무리는 한 줄 요약. 본문 슬라이드는 반드시 줄바꿈(\\n)으로 구분된 4개 항목으로 작성: 첫째줄=핵심요약(16자 이내), 둘째줄=소제목(12자 이내), 셋째~넷째줄=세부내용(각 12~16자 이내), 전체 64자 이내",
      "imagePrompt": "영어로 이미지 설명, 사실적 사진 스타일, no text, no watermark"
    }
  ]
}
JSON만 반환.`,
      },
    ],
    "카드뉴스 기획 전문가. JSON만 반환합니다."
  );
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("기획서 파싱 실패 — 다시 시도해주세요");
  return parsePlanningJson(raw);
}
