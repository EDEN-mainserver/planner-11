// 카드 HTML(cardHtmls) 배열을 숨겨진 iframe에 렌더한 뒤 html2canvas로 캡처해
// JPEG dataURL 배열로 돌려준다. Instagram/Threads 게시에 공통으로 사용.
//
// logFn(msg) — 진행 로그를 받기 위한 선택적 콜백
// 최대 카드 수: 10장 (Instagram 캐러셀 제약)

const CAPTURE_WIDTH = 1080;
const CAPTURE_HEIGHT = 1350;
const MAX_CARDS = 10;
const FONT_WAIT_MS = 1200;

export async function captureCardsToImages(cardHtmls, logFn = null) {
  if (!Array.isArray(cardHtmls) || cardHtmls.length === 0) return [];

  const { default: html2canvas } = await import("html2canvas");
  const targets = cardHtmls.slice(0, MAX_CARDS);
  const images = [];

  for (let i = 0; i < targets.length; i++) {
    if (logFn) logFn(`카드 ${i + 1}/${targets.length} 캡처 중...`);
    const dataUrl = await captureSingleCard(targets[i], html2canvas);
    images.push(dataUrl);
  }

  if (logFn) logFn(`브라우저 캡처 완료: ${images.length}장`);
  return images;
}

function captureSingleCard(html, html2canvas) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([html], { type: "text/html" });
    const blobUrl = URL.createObjectURL(blob);
    const iframe = document.createElement("iframe");
    iframe.style.cssText = `position:fixed;left:-9999px;top:0;width:${CAPTURE_WIDTH}px;height:${CAPTURE_HEIGHT}px;border:none;z-index:-999;pointer-events:none;`;
    iframe.src = blobUrl;

    const cleanup = () => {
      URL.revokeObjectURL(blobUrl);
      iframe.remove();
    };

    iframe.onload = async () => {
      try {
        const doc = iframe.contentDocument;
        await doc.fonts.ready;
        await new Promise((r) => setTimeout(r, FONT_WAIT_MS));
        const canvas = await html2canvas(doc.documentElement, {
          width: CAPTURE_WIDTH,
          height: CAPTURE_HEIGHT,
          windowWidth: CAPTURE_WIDTH,
          windowHeight: CAPTURE_HEIGHT,
          scale: 1,
          useCORS: true,
          allowTaint: false,
          backgroundColor: "#080814",
          logging: false,
          x: 0,
          y: 0,
        });
        cleanup();
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      } catch (e) {
        cleanup();
        reject(e);
      }
    };

    iframe.onerror = () => {
      cleanup();
      reject(new Error("iframe 로드 실패"));
    };

    document.body.appendChild(iframe);
  });
}

// cards[].imageUrl 우선 수집 + 없으면 cardHtmls 캡처 fallback.
// Instagram/Threads 양쪽에서 게시 직전 호출하는 표준 진입점.
export async function collectPostImages({ cards, cardHtmls, logFn = null }) {
  let images = (cards || [])
    .map((c) => c.imageUrl)
    .filter((u) => typeof u === "string" && u.length > 0);
  if (logFn) logFn(`카드 imageUrl 수집: ${images.length}개`);

  if (images.length === 0 && Array.isArray(cardHtmls) && cardHtmls.length > 0) {
    if (logFn) logFn(`HTML 카드 감지 (${cardHtmls.length}장) → 브라우저 캡처 시작`);
    const captured = await captureCardsToImages(cardHtmls, logFn);
    images = images.concat(captured);
  }

  return images;
}
