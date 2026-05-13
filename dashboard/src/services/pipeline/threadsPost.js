// Threads 게시 (서버 측 html-screenshot 캡처 → /api/threads-post)
// cards[].imageUrl 우선, 없으면 cardHtmls를 서버에서 이미지로 변환해 사용.
//
// 반환 형태:
//   { status: "success", message, permalink } — 게시 성공
//   throw Error — 검증/네트워크/API 실패

async function resolveImageList({ cards, cardHtmls }) {
  const direct = (cards || []).map((c) => c.imageUrl).filter(Boolean);
  if (direct.length > 0) return direct;

  if (!Array.isArray(cardHtmls) || cardHtmls.length === 0) {
    throw new Error("게시할 이미지가 없습니다. 카드를 먼저 조립해주세요.");
  }
  const shotRes = await fetch("/api/html-screenshot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ htmls: cardHtmls }),
  });
  const shotData = await shotRes.json();
  if (!shotRes.ok) throw new Error(shotData.error || "카드 이미지 변환 실패");
  return Array.isArray(shotData.images) ? shotData.images : [];
}

export async function postToThreadsAPI({ thConfig, cards, cardHtmls, caption }) {
  if (!thConfig?.userId || !thConfig?.accessToken) {
    throw new Error("스레드 사용자 ID와 액세스 토큰을 입력해주세요");
  }

  const imageList = await resolveImageList({ cards, cardHtmls });
  if (imageList.length === 0) {
    throw new Error("변환된 이미지가 없습니다.");
  }

  const res = await fetch("/api/threads-post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: thConfig.userId,
      accessToken: thConfig.accessToken,
      images: imageList,
      caption,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "스레드 게시 실패");

  return {
    status: "success",
    message: `스레드 게시 완료!${data.permalink ? ` → ${data.permalink}` : ""}`,
    permalink: data.permalink,
  };
}
