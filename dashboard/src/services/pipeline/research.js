import { callGemini } from "../../utils/gemini";

export async function runResearch(topic) {
  let articlesText = "(네이버 검색 결과 없음)";
  try {
    const res = await fetch(
      `/api/naver-search?query=${encodeURIComponent(topic)}&display=10&sort=sim`
    );
    if (res.ok) {
      const data = await res.json();
      const items = (data.items || []).slice(0, 8);
      if (items.length > 0) {
        articlesText = items
          .map(
            (a, i) =>
              `[${i + 1}] ${a.title?.replace(/<[^>]+>/g, "")} — ${a.description?.replace(/<[^>]+>/g, "")}`
          )
          .join("\n");
      }
    }
  } catch {
    // 검색 실패 시 Gemini 단독 생성으로 진행한다.
  }

  const summary = await callGemini(
    [
      {
        role: "user",
        content: `주제: "${topic}"\n\n검색 결과:\n${articlesText}\n\n카드뉴스 제작을 위한 리서치 보고서를 작성해줘. 핵심 메시지 5-7가지, 통계/수치, 독자 인사이트 중심으로. 마크다운 형식.`,
      },
    ],
    "콘텐츠 리서처. 카드뉴스 제작을 위한 핵심 정보를 추출·요약합니다."
  );
  if (!summary || !summary.trim()) {
    throw new Error("리서치 결과가 비어있습니다. 잠시 후 다시 시도하거나 Gemini API 키/모델을 확인하세요.");
  }
  return summary;
}
