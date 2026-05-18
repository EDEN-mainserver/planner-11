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

function captureSingleCard(html, html2canvas, mime = "image/jpeg", quality = 0.92) {
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
        // PNG는 quality 인자 무시됨 (브라우저 표준).
        resolve(mime === "image/png" ? canvas.toDataURL("image/png") : canvas.toDataURL(mime, quality));
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

// 단일 HTML을 PNG(기본) 또는 JPEG dataURL로 캡처 — 브라우저 측 html2canvas.
// background-clip:text 같은 일부 CSS 효과는 한계가 있어 단순 디자인에 적합.
export async function captureSingleHtmlToImage(html, { mime = "image/png", quality = 0.95 } = {}) {
  if (!html) return null;
  const { default: html2canvas } = await import("html2canvas");
  return captureSingleCard(html, html2canvas, mime, quality);
}

// 서버 측 Puppeteer로 캡처 — background-clip:text 등 모든 CSS 효과를 그대로 렌더.
// 시간 5~15초 (콜드 스타트 포함). 다운로드 등 정확성 우선 케이스에 사용.
// format: "png" | "jpeg" (default "png")
export async function captureViaServerScreenshot(html, format = "png") {
  if (!html) return null;
  const res = await fetch("/api/html-screenshot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ htmls: [html], format }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `캡처 실패 (${res.status})`);
  const dataUrl = data?.images?.[0];
  if (!dataUrl) throw new Error("캡처 결과가 비어있음");
  return dataUrl;
}

// 합성된 카드(cardHtmls) 우선 캡처 — title/body/디자인 오버레이 포함된 완성본.
// cardHtmls 없을 때만 raw cards[].imageUrl (AI 배경) 로 폴백.
// Instagram/Threads 양쪽에서 게시 직전 호출하는 표준 진입점.
export async function collectPostImages({ cards, cardHtmls, logFn = null }) {
  // 1) 합성 카드 HTML이 있으면 서버 puppeteer로 일괄 캡처 (네트워크 1회로 7장 처리)
  if (Array.isArray(cardHtmls) && cardHtmls.length > 0) {
    if (logFn) logFn(`합성 카드 캡처: ${cardHtmls.length}장 (서버 puppeteer)`);
    const res = await fetch("/api/html-screenshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ htmls: cardHtmls, format: "png" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !Array.isArray(data.images) || data.images.length === 0) {
      if (logFn) logFn(`합성 캡처 실패 (${data.error || res.status}) → raw 배경으로 폴백`);
    } else {
      if (logFn) logFn(`합성 캡처 완료: ${data.images.length}장`);
      return data.images;
    }
  }

  // 2) 폴백: raw cards[].imageUrl (디자인 오버레이 없는 AI 배경만)
  const images = (cards || [])
    .map((c) => c.imageUrl)
    .filter((u) => typeof u === "string" && u.length > 0);
  if (logFn) logFn(`raw 배경 수집 (폴백): ${images.length}개`);
  return images;
}
