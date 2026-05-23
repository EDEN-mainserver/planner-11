import { callGemini } from "../../utils/gemini";

const stripTags = (s = "") => s.replace(/<[^>]+>/g, "").trim();

export async function runResearch(topic) {
  let sources = [];
  let articlesText = "(네이버 검색 결과 없음)";
  try {
    const res = await fetch(
      `/api/naver-search?query=${encodeURIComponent(topic)}&display=30&sort=date&enrich=true&enrichCount=3&filterAds=true`
    );
    if (res.ok) {
      const data = await res.json();
      const items = (data.items || []).slice(0, 8);
      if (items.length > 0) {
        sources = items.map((a) => ({
          title: stripTags(a.title),
          link: a.link,
          bloggername: a.bloggername || "",
          description: stripTags(a.description),
          content: a.content || "",
        }));
        articlesText = sources
          .map((s, i) => {
            const head = `[${i + 1}] ${s.title} — ${s.description}`;
            const body = s.content ? `\n  본문발췌: ${s.content.slice(0, 700)}` : "";
            return head + body;
          })
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
        content: `주제: "${topic}"\n\n검색 결과:\n${articlesText}\n\n카드뉴스 제작을 위한 리서치 보고서를 작성해줘. 핵심 메시지 5-7가지, 통계/수치, 독자 인사이트 중심으로. 마크다운 형식. 검색 결과에 근거를 둔 내용은 가능하면 [번호]로 출처 표기해.`,
      },
    ],
    "콘텐츠 리서처. 카드뉴스 제작을 위한 핵심 정보를 추출·요약합니다. 검색 결과(본문 발췌 포함)에 근거해 작성하고, 근거 없는 환각을 피하세요."
  );
  if (!summary || !summary.trim()) {
    throw new Error("리서치 결과가 비어있습니다. 잠시 후 다시 시도하거나 Gemini API 키/모델을 확인하세요.");
  }
  return { summary, sources };
}
