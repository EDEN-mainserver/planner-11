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
        headline: shortenText(slide.headline, 26),
        bodyLines,
        body: shortenLines(bodyLines.length ? bodyLines.join("\n") : slide.body, 28, 6, 180),
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
      "headline": "제목(한 줄, 18~26자 이내). 글자수 안에서 의미가 완결되도록 작성. 말줄임표(…)로 끝내지 말 것",
      "body": "본문 — 표지/마무리는 2~3문장. 본문 슬라이드는 반드시 줄바꿈(\\n)으로 구분된 5~6개 항목: 첫째줄=핵심요약(20~28자), 둘째줄=소제목(16~22자), 셋째~여섯째줄=세부내용(각 18~28자), 전체 140~180자. 줄마다 의미 완결, 문장 도중에 끊지 말 것",
      "imagePrompt": "영어로 이미지 설명, 사실적 사진 스타일, no text, no watermark, 인스타 카드뉴스 배경용 (1080x1350)"
    }
  ]
}

엄수사항:
- 마지막 슬라이드(part="마무리")는 행동 촉구나 명확한 결론으로 마무리할 것. "다음 편에", "곧 공개", "기대해주세요" 같은 미완·예고 표현 금지.
- 모든 문장은 글자수 제한 안에서 의미가 완결되도록 작성. 말줄임표로 미완 처리 금지.
- imagePrompt는 글자(text)가 포함되지 않은 분위기 이미지 위주. 카드 디자인 배경으로 어울리는 비주얼.

JSON만 반환.`,
      },
    ],
    "카드뉴스 기획 전문가. JSON만 반환합니다."
  );
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("기획서 파싱 실패 — 다시 시도해주세요");
  return parsePlanningJson(raw);
}
