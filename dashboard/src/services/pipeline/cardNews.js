import { FONT_CSS } from "../../eattack/pipeline/fonts";

export function buildHtmlFromTemplate(slides, template, topicStr, brandStr) {
  const esc = (s) =>
    String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const brand = esc(brandStr || "브랜드");
  const cardBlocks = slides
    .map((s, i) => {
      let card = template;
      card = card.split("CARD_NUM").join(String(i + 1).padStart(2, "0"));
      card = card.split("CARD_HEADLINE").join(esc(s.headline));
      card = card.split("CARD_BODY").join(esc(s.body || ""));
      card = card.split("CARD_BRAND").join(brand);
      card = card.split("CARD_IMAGE_URL").join(s.imageUrl || "");
      return card;
    })
    .join("\n\n");
  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><title>${esc(topicStr)} — 카드뉴스</title>
<style>body{background:#111;padding:20px;display:flex;flex-wrap:wrap;gap:16px;margin:0}</style>
</head>
<body>${cardBlocks}</body>
</html>`;
}

// ── HTML 카드뉴스 빌드 (브랜드 컬러 2개 + 폰트 지원) ──
export function buildHtmlCardNews(topic, cards, brandName, color1, color2, font) {
  const brand = brandName || "브랜드";
  const fontFamily = FONT_CSS[font] || FONT_CSS.sans;

  const escHtml = (s) =>
    String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const cardBlocks = cards
    .map((card, i) => {
      const isDark = i % 2 === 0;
      const bg = isDark ? "#0A0A0A" : "#FAFAFA";
      const tc = isDark ? "#ffffff" : "#0A0A0A";
      const isCover = card.part === "표지";
      const isClosing = card.part === "마무리";

      const imgBlock = card.imageUrl
        ? `<div class="img-wrap">
            <img src="${card.imageUrl}" alt="${escHtml(card.headline)}" />
            <div class="img-ov"></div>
          </div>`
        : `<div class="img-placeholder" style="background:linear-gradient(135deg,${color1}cc,${color2}55)"></div>`;

      return `
  <div class="card" style="background:${bg};color:${tc}">
    ${isClosing ? "" : imgBlock}
    ${
      isClosing
        ? `<div class="card-inner closing" style="background:linear-gradient(160deg,${color1},${color2}88)">
          <p class="num" style="color:rgba(255,255,255,0.5)">${i + 1} / ${cards.length}</p>
          <h2 class="headline" style="color:#fff">${escHtml(card.headline)}</h2>
          ${card.body ? `<p class="body" style="color:rgba(255,255,255,0.85)">${escHtml(card.body)}</p>` : ""}
          <p class="brand-name" style="color:#fff">${escHtml(brand)}</p>
        </div>`
        : `<div class="card-inner ${isCover ? "cover" : "content"}">
          <p class="num" style="color:${isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)"}">${i + 1} / ${cards.length}</p>
          <h2 class="headline" style="color:${isCover ? "#fff" : tc}">${escHtml(card.headline)}</h2>
          ${card.body ? `<p class="body" style="color:${isCover ? "rgba(255,255,255,0.9)" : isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.7)"}">${escHtml(card.body)}</p>` : ""}
          ${i === cards.length - 1 ? `<p class="brand-name" style="color:${color1}">${escHtml(brand)}</p>` : ""}
        </div>`
    }
  </div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${escHtml(topic)} — 카드뉴스</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #111;
    padding: 20px;
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    font-family: ${fontFamily};
  }
  .card {
    width: 1080px;
    height: 1350px;
    position: relative;
    overflow: hidden;
    flex-shrink: 0;
    border-radius: 4px;
  }
  .img-wrap {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 58%;
  }
  .img-wrap img {
    width: 100%; height: 100%;
    object-fit: cover;
    display: block;
  }
  .img-ov {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 70%;
    background: linear-gradient(transparent, rgba(0,0,0,0.75));
  }
  .img-placeholder {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
  }
  .card-inner {
    position: absolute;
    left: 0; right: 0; bottom: 0;
    padding: 56px 60px;
    z-index: 10;
  }
  .card-inner.cover {
    top: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }
  .card-inner.closing {
    top: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
  }
  .num {
    font-size: 22px;
    margin-bottom: 24px;
    letter-spacing: 0.05em;
  }
  .headline {
    font-size: 58px;
    font-weight: 700;
    line-height: 1.15;
    margin-bottom: 28px;
    word-break: keep-all;
  }
  .body {
    font-size: 32px;
    line-height: 1.7;
    word-break: keep-all;
    margin-bottom: 20px;
  }
  .brand-name {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: 0.08em;
    margin-top: 20px;
  }
</style>
</head>
<body>
${cardBlocks}
</body>
</html>`;
}

// ── 프리미엄 인스타 템플릿 빌드 (커버/본문/CTA) — 레퍼런스 디자인 기반 ──
export function buildPremiumTemplate(topic, cards, brandName, accentColor) {
  const accent = accentColor || "#9b8eff";
  const brand = brandName || "브랜드";
  const esc = (s) =>
    String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const clampStyle = (lines) =>
    `display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:${lines};overflow:hidden;`;
  const shrink = 0.8;
  // 액센트 컬러 → rgba 사용을 위해 RGB 추출
  const ah = accent.replace("#", "");
  const accentRgb = `${parseInt(ah.slice(0,2),16)},${parseInt(ah.slice(2,4),16)},${parseInt(ah.slice(4,6),16)}`;

  let chapterIdx = 0;
  const bodyCards = cards.filter((c) => c.part !== "표지" && c.part !== "마무리");

  const blocks = cards.map((card, i) => {
    const isCover = card.part === "표지";
    const isCTA = card.part === "마무리";
    const isBody = !isCover && !isCTA;
    if (isBody) chapterIdx++;
    const chNum = String(chapterIdx).padStart(2, "0");

    // ── 커버 ──
    if (isCover) {
      const previewChips = bodyCards.slice(0, 3).map((bc, ci) => {
        const chipSub = (bc.body || "").split(/[·•\n]/)[0].trim();
        return `
        <div style="display:flex;align-items:center;gap:14px;
          background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);
          border-radius:12px;padding:14px 22px;overflow:hidden;">
          <div style="width:32px;height:32px;background:${accent};border-radius:8px;
            display:flex;align-items:center;justify-content:center;
            font-size:15px;font-weight:800;color:#fff;flex-shrink:0;">${ci + 1}</div>
          <span style="font-size:${Math.round(22 * shrink)}px;font-weight:600;color:rgba(255,255,255,.85);line-height:1.25;
            ${clampStyle(1)}flex:1;min-width:0;">${esc(bc.headline)}</span>
          ${chipSub ? `<span style="font-size:${Math.round(17 * shrink)}px;color:rgba(255,255,255,.35);line-height:1.25;white-space:nowrap;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;max-width:200px;">${esc(chipSub)}</span>` : ""}
        </div>`;
      }).join("");

      return `
<div style="width:1080px;height:1350px;overflow:hidden;position:relative;background:#080812;
  display:flex;flex-direction:column;justify-content:flex-end;padding:72px 72px 90px;
  font-family:'Noto Sans KR',sans-serif;flex-shrink:0;">
  ${card.imageUrl ? `
  <img src="${card.imageUrl}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;" />
  <div style="position:absolute;inset:0;background:rgba(4,4,18,0.72);z-index:0;"></div>` : ""}
  <div style="position:absolute;inset:0;background:
    radial-gradient(ellipse 80% 60% at 110% -10%,rgba(120,80,255,.28) 0%,transparent 55%),
    radial-gradient(ellipse 60% 50% at -10% 110%,rgba(80,40,200,.2) 0%,transparent 55%),
    radial-gradient(ellipse 40% 40% at 50% 50%,rgba(60,20,120,.15) 0%,transparent 60%);"></div>
  <div style="position:absolute;inset:0;background-image:
    linear-gradient(rgba(155,142,255,.04) 1px,transparent 1px),
    linear-gradient(90deg,rgba(155,142,255,.04) 1px,transparent 1px);
    background-size:72px 72px;"></div>
  <div style="position:absolute;width:500px;height:500px;top:-180px;right:-160px;
    border-radius:50%;border:1px solid rgba(155,142,255,.12);"></div>
  <div style="position:absolute;width:700px;height:700px;top:-280px;right:-260px;
    border-radius:50%;border:1px solid rgba(155,142,255,.06);"></div>
  <div style="position:absolute;width:320px;height:320px;bottom:60px;left:-100px;
    border-radius:50%;border:1px solid rgba(155,142,255,.08);"></div>
  <div style="position:absolute;width:300px;height:300px;top:80px;right:80px;
    border-radius:50%;background:radial-gradient(circle,rgba(155,142,255,.18) 0%,transparent 70%);
    filter:blur(20px);"></div>
  <div style="position:absolute;top:64px;left:72px;z-index:10;display:inline-flex;align-items:center;
    gap:8px;border:1.5px solid rgba(155,142,255,.75);border-radius:50px;padding:10px 22px;
    color:#fff;font-size:20px;font-weight:700;letter-spacing:.12em;background:rgba(155,142,255,.1);">
    <span style="width:7px;height:7px;border-radius:50%;background:${accent};display:inline-block;flex-shrink:0;"></span>
    ${esc(brand).toUpperCase()}
  </div>
  <div style="position:relative;z-index:10;overflow:hidden;">
    <div style="font-size:${Math.round(24 * shrink)}px;font-weight:500;color:rgba(255,255,255,.5);margin-bottom:14px;
      overflow:hidden;white-space:nowrap;letter-spacing:.03em;">${esc(topic)}</div>
    <div style="font-size:${Math.round(82 * shrink)}px;font-weight:900;color:#fff;line-height:1.1;letter-spacing:-.025em;
      word-break:keep-all;${clampStyle(2)}margin-bottom:32px;">${esc(card.headline)}</div>
    ${previewChips ? `<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:40px;overflow:hidden;">${previewChips}</div>` : ""}
    <div style="display:inline-flex;align-items:center;gap:8px;
      background:linear-gradient(90deg,rgba(155,142,255,.2),rgba(100,70,220,.15));
      border:1px solid rgba(155,142,255,.3);border-radius:12px;padding:17px 26px;
      color:rgba(255,255,255,.85);font-size:${Math.round(22 * shrink)}px;font-weight:500;overflow:hidden;white-space:nowrap;max-width:100%;">
      ${card.body ? esc(card.body) : "댓글 &amp; 팔로우로 더 많은 콘텐츠를"}
      <span style="color:${accent};font-weight:700;margin-left:6px;">&gt;&gt;</span>
    </div>
  </div>
</div>`;
    }

    // ── CTA ──
    if (isCTA) {
      const summaryChips = bodyCards.map((bc, ci) => {
        const firstBullet = (bc.body || "").split(/[·•\n]/)[0].trim();
        return `
        <div style="display:flex;align-items:center;gap:12px;background:#fff;
          border-radius:12px;padding:16px 20px;box-shadow:0 2px 12px rgba(0,0,0,.05);overflow:hidden;">
          <div style="width:32px;height:32px;background:${accent};border-radius:8px;
            display:flex;align-items:center;justify-content:center;
            font-size:15px;font-weight:800;color:#fff;flex-shrink:0;">${ci + 1}</div>
          <div style="font-size:21px;font-weight:800;color:#111;white-space:nowrap;
            overflow:hidden;text-overflow:ellipsis;">${esc(bc.headline)}</div>
          ${firstBullet ? `<div style="font-size:17px;color:#888;margin-left:auto;white-space:nowrap;
            overflow:hidden;text-overflow:ellipsis;flex-shrink:0;">${esc(firstBullet)}</div>` : ""}
        </div>`;
      }).join("");

      const handle = `@${esc(brand.toLowerCase().replace(/\s+/g, "_"))}`;

      return `
<div style="width:1080px;height:1350px;overflow:hidden;background:#f0f0f2;display:flex;
  flex-direction:column;align-items:center;justify-content:center;padding:0 90px;
  position:relative;font-family:'Noto Sans KR',sans-serif;flex-shrink:0;">
  <div style="position:absolute;top:60px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:12px;">
    <div style="font-size:20px;font-weight:800;color:#444;letter-spacing:.14em;">${esc(brand).toUpperCase()}</div>
    <div style="width:60px;height:1.5px;background:#ccc;"></div>
  </div>
  <div style="display:flex;flex-direction:column;gap:10px;width:100%;margin-bottom:40px;overflow:hidden;">
    ${summaryChips}
  </div>
  <div style="text-align:center;margin-bottom:40px;overflow:hidden;">
    <div style="font-size:${Math.round(30 * shrink)}px;font-weight:700;color:#111;line-height:1.5;word-break:keep-all;${clampStyle(2)}">${esc(card.headline)}</div>
    ${card.body ? `<div style="font-size:${Math.round(24 * shrink)}px;color:#888;line-height:1.5;margin-top:8px;word-break:keep-all;${clampStyle(2)}">${esc(card.body)}</div>` : ""}
  </div>
  <div style="background:#fff;border-radius:20px;padding:30px 36px;width:100%;
    box-shadow:0 4px 28px rgba(0,0,0,.08);overflow:hidden;">
    <div style="display:flex;align-items:center;gap:20px;">
      <div style="width:84px;height:84px;border-radius:50%;
        background:linear-gradient(135deg,${accent},#6b4fc8);
        display:flex;align-items:center;justify-content:center;
        flex-shrink:0;border:2px solid rgba(155,142,255,.3);">
        <span style="color:#fff;font-size:34px;font-weight:900;">${esc(brand).charAt(0)}</span>
      </div>
      <div style="flex:1;overflow:hidden;min-width:0;display:flex;flex-direction:column;gap:4px;">
        <div style="font-size:${Math.round(28 * shrink)}px;font-weight:900;color:#111;line-height:1.1;
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(brand)}</div>
        <div style="font-size:${Math.round(16 * shrink)}px;color:#666;line-height:1.25;word-break:keep-all;${clampStyle(1)}">${esc(topic)}</div>
      </div>
      <div style="background:#4c6ef5;color:#fff;font-size:${Math.round(21 * shrink)}px;font-weight:700;
        padding:13px 26px;border-radius:11px;flex-shrink:0;white-space:nowrap;">Follow</div>
    </div>
  </div>
  <div style="border:2px solid #bbb;border-radius:50px;padding:13px 52px;
    font-size:${Math.round(24 * shrink)}px;font-weight:600;color:#555;white-space:nowrap;overflow:hidden;margin-top:32px;">
    ${handle}
  </div>
  <div style="position:absolute;bottom:50px;left:0;right:0;text-align:center;
    font-size:${Math.round(19 * shrink)}px;color:#bbb;font-weight:400;overflow:hidden;white-space:nowrap;">
    팔로우하고 더 많은 콘텐츠를 받아보세요
  </div>
</div>`;
    }

    // ── 본문 (다크 배경 + 브라우저 목업 부유) ──
    const nextCard = cards[i + 1];
    const teaserText = nextCard
      ? nextCard.part === "마무리" ? "마지막 정리로" : esc(nextCard.headline)
      : "다음 내용으로";

    const bullets = (card.body || "")
      .split(/[·•\n]/).map((l) => l.trim()).filter((l) => l.length > 0);

    // bullets[0]=요약, bullets[1]=소제목(3개 이상일 때), bullets[2..last-1]=스킬, bullets[last]=효과
    const summaryText  = bullets[0] || esc(card.headline);
    const pluginSub    = bullets.length >= 3 ? bullets[1] : "";
    const skillBullets = bullets.length >= 4 ? bullets.slice(2, bullets.length - 1).slice(0, 4) : [];
    const effectText   = bullets.length >= 2 ? bullets[bullets.length - 1] : `${esc(card.headline)} — 더 알아보세요`;

    // 배경 레이어
    const bgLayer = card.imageUrl
      ? `<img src="${card.imageUrl}" style="position:absolute;inset:0;width:100%;height:100%;
           object-fit:cover;z-index:0;" />
         <div style="position:absolute;inset:0;background:rgba(4,4,16,.80);z-index:1;"></div>`
      : `<div style="position:absolute;inset:0;z-index:0;background-image:
           linear-gradient(rgba(${accentRgb},.04) 1px,transparent 1px),
           linear-gradient(90deg,rgba(${accentRgb},.04) 1px,transparent 1px);
           background-size:64px 64px;"></div>
         <div style="position:absolute;inset:0;z-index:0;
           background:radial-gradient(ellipse 70% 45% at 50% 108%,rgba(${accentRgb},.14) 0%,transparent 60%);"></div>`;

    // ── 콘텐츠 시각화 — 카드 내용에 따라 자동 선택 ──
    const allText = [card.headline, ...(bullets || [])].join(' ');
    const isFolder  = /폴더|디렉토리|구조|파일|경로|프로젝트|셋업|setup|directory|folder/i.test(allText);
    const isSteps   = skillBullets.length >= 2 && /단계|순서|먼저|다음으로|마지막|절차|방법|step|과정/i.test(allText);
    const isStats   = skillBullets.some(b => /\d[\d,]*%|\d+배|\d+만|\d+억|\d+개|\d+명|\d+시간/.test(b));
    const isCompare = /\bvs\b|비교|차이점|장단점|vs\./.test(allText);

    const cmdList = skillBullets.length >= 1
      ? skillBullets
      : [summaryText, effectText].filter((t, ii, a) => t && a.indexOf(t) === ii);

    let contentHtml;

    if (isFolder) {
      // ── 폴더 구조 시각화 ──
      const rootName = esc(card.headline).slice(0, 16).replace(/\s/g, '-').toLowerCase() + '/';
      const items = cmdList.slice(0, 6).map((b, ii) => {
        const isFile = /\.\w{2,5}$/.test(b.split(' ')[0]) || /파일|\.md|\.json|\.js|\.py|\.ts/.test(b);
        const last = ii === cmdList.slice(0, 6).length - 1;
        return { prefix: last ? '└── ' : '├── ', icon: isFile ? '📄' : '📁',
          name: esc(b.slice(0, 22)), highlight: ii === 0, last };
      });
      contentHtml = `
      <div style="width:100%;flex:1;min-height:180px;display:flex;flex-direction:column;gap:10px;overflow:hidden;margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
          <div style="font-size:${Math.round(20 * shrink)}px;font-weight:700;color:#222;">📁 구조 파악</div>
          <div style="background:#1a1a2e;color:#9b8eff;font-size:${Math.round(14 * shrink)}px;font-weight:600;padding:4px 12px;border-radius:6px;white-space:nowrap;">directory</div>
        </div>
        <div style="flex:1;min-height:0;background:#0d1117;border-radius:14px;overflow:hidden;display:flex;flex-direction:column;">
          <div style="height:36px;background:#161b22;display:flex;align-items:center;padding:0 16px;gap:8px;flex-shrink:0;border-bottom:1px solid #21262d;">
            <div style="width:11px;height:11px;border-radius:50%;background:#ff5f57;"></div>
            <div style="width:11px;height:11px;border-radius:50%;background:#febc2e;"></div>
            <div style="width:11px;height:11px;border-radius:50%;background:#28c840;"></div>
            <div style="margin-left:10px;font-size:${Math.round(14 * shrink)}px;color:#8b949e;font-family:'Courier New',monospace;">📁 ${rootName}</div>
          </div>
          <div style="flex:1;padding:14px 20px;overflow:hidden;display:flex;flex-direction:column;justify-content:center;gap:4px;">
            ${items.map(t => `
            <div style="display:flex;align-items:center;gap:6px;height:28px;">
              <span style="font-family:'Courier New',monospace;font-size:${Math.round(16 * shrink)}px;color:${t.highlight ? '#ffa657' : '#4a5568'};flex-shrink:0;">${t.prefix}</span>
              <span style="font-size:16px;flex-shrink:0;">${t.icon}</span>
              <span style="font-family:'Courier New',monospace;font-size:${Math.round(16 * shrink)}px;color:${t.highlight ? '#ffa657' : '#e6edf3'};font-weight:${t.highlight ? '700' : '400'};overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${t.name}</span>
              ${t.highlight ? `<span style="font-family:'Courier New',monospace;font-size:${Math.round(14 * shrink)}px;color:#28c840;margin-left:8px;font-weight:700;">← 핵심</span>` : ''}
            </div>`).join('')}
          </div>
        </div>
      </div>`;

    } else if (isStats) {
      // ── 통계 카드 시각화 ──
      const statItems = cmdList.slice(0, 4);
      const statColors = [accent, '#22c55e', '#f59e0b', '#ec4899'];
      contentHtml = `
      <div style="width:100%;flex:1;min-height:180px;display:flex;flex-direction:column;gap:10px;overflow:hidden;margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
          <div style="font-size:${Math.round(20 * shrink)}px;font-weight:700;color:#222;">📊 핵심 수치</div>
          <div style="background:#1a1a2e;color:#9b8eff;font-size:${Math.round(14 * shrink)}px;font-weight:600;padding:4px 12px;border-radius:6px;white-space:nowrap;">stats</div>
        </div>
        <div style="flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;gap:10px;overflow:hidden;">
          ${statItems.map((b, ii) => {
            const numMatch = b.match(/(\d[\d,]*%?|\d+배|\d+만|\d+억|\d+개|\d+명|\d+시간)/);
            const num = numMatch ? numMatch[1] : `0${ii+1}`;
            const label = b.replace(num, '').trim().slice(0, 28) || esc(b).slice(0, 28);
            return `<div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:14px;padding:22px 16px 16px;display:flex;flex-direction:column;justify-content:flex-start;gap:10px;overflow:hidden;">
              <div style="font-size:${Math.round(36 * shrink)}px;font-weight:900;color:${statColors[ii % 4]};line-height:1;margin-bottom:6px;overflow:hidden;white-space:nowrap;">${esc(num)}</div>
              <div style="font-size:${Math.round(16 * shrink)}px;color:#aaa;word-break:keep-all;line-height:1.35;${clampStyle(1)}">${esc(label)}</div>
            </div>`;
          }).join('')}
        </div>
      </div>`;

    } else if (isSteps) {
      // ── 단계별 타임라인 시각화 ──
      const stepItems = cmdList.slice(0, 5);
      contentHtml = `
      <div style="width:100%;flex:1;min-height:180px;display:flex;flex-direction:column;gap:10px;overflow:hidden;margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
          <div style="font-size:${Math.round(20 * shrink)}px;font-weight:700;color:#222;">⚡ 실행 순서</div>
          <div style="background:#1a1a2e;color:#9b8eff;font-size:${Math.round(14 * shrink)}px;font-weight:600;padding:4px 12px;border-radius:6px;white-space:nowrap;">${stepItems.length} steps</div>
        </div>
        <div style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:6px;overflow:hidden;">
          ${stepItems.map((b, ii) => `
          <div style="display:flex;align-items:flex-start;gap:12px;overflow:hidden;">
            <div style="width:30px;height:30px;border-radius:50%;background:${accent};color:#fff;font-weight:700;font-size:${Math.round(15 * shrink)}px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${ii + 1}</div>
            ${ii < stepItems.length - 1 ? `<div style="position:absolute;"></div>` : ''}
            <div style="flex:1;background:#f8f9fa;border-radius:10px;padding:8px 14px;min-height:30px;display:flex;align-items:center;overflow:hidden;">
              <span style="font-size:${Math.round(17 * shrink)}px;color:#222;font-weight:500;word-break:keep-all;line-height:1.25;${clampStyle(2)}">${esc(b)}</span>
            </div>
          </div>`).join('')}
        </div>
      </div>`;

    } else if (isCompare) {
      // ── 비교 시각화 ──
      const half = Math.ceil(cmdList.length / 2);
      const leftItems  = cmdList.slice(0, half);
      const rightItems = cmdList.slice(half);
      contentHtml = `
      <div style="width:100%;flex:1;min-height:180px;display:flex;flex-direction:column;gap:10px;overflow:hidden;margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
          <div style="font-size:${Math.round(20 * shrink)}px;font-weight:700;color:#222;">⚖️ 비교 분석</div>
          <div style="background:#1a1a2e;color:#9b8eff;font-size:${Math.round(14 * shrink)}px;font-weight:600;padding:4px 12px;border-radius:6px;white-space:nowrap;">compare</div>
        </div>
        <div style="flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;gap:10px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:8px;overflow:hidden;">
            <div style="font-size:${Math.round(14 * shrink)}px;color:#ff7b72;font-weight:700;letter-spacing:.08em;flex-shrink:0;">Before</div>
            ${leftItems.map(b => `<div style="font-size:${Math.round(15 * shrink)}px;color:#ccc;word-break:keep-all;line-height:1.4;${clampStyle(2)}">· ${esc(b)}</div>`).join('')}
          </div>
          <div style="background:linear-gradient(135deg,#0d2a1a,#0a2016);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:8px;overflow:hidden;">
            <div style="font-size:${Math.round(14 * shrink)}px;color:#7ee787;font-weight:700;letter-spacing:.08em;flex-shrink:0;">After</div>
            ${rightItems.map(b => `<div style="font-size:${Math.round(15 * shrink)}px;color:#ccc;word-break:keep-all;line-height:1.4;${clampStyle(2)}">· ${esc(b)}</div>`).join('')}
          </div>
        </div>
      </div>`;

    } else {
      // ── 기본: 코드 에디터 (key: value) ──
      const keyNames = ['auto-plan','auto-review','auto-debug','auto-test','auto-commit','auto-deploy','multi-agent','pdca-mode'];
      const valColors = ['#a5d6ff','#7ee787','#ffa657','#ff7b72','#d2a8ff','#a5d6ff'];
      let lineNum = 1;
      const headerLines = [
        { type: 'comment', text: '# CLAUDE.md — 바로 붙여넣기 가능한 설정' },
        { type: 'comment', text: `# Plugin: ${esc(card.headline).slice(0, 20)}` },
        { type: 'blank' },
      ];
      const codeLines = [
        ...headerLines,
        ...cmdList.map((cmd, ii) => ({ type: 'setting', key: keyNames[ii] || `feature-${ii+1}`, value: esc(cmd), valColor: valColors[ii % valColors.length] })),
        { type: 'blank' },
        { type: 'bool', key: 'hooks-enabled', value: 'true' },
      ];
      const renderLine = (line) => {
        const n = lineNum++;
        const numHtml = `<span style="color:#4a5568;font-size:16px;font-family:'Courier New',monospace;width:32px;text-align:right;padding-right:16px;flex-shrink:0;user-select:none;">${n}</span>`;
        if (line.type === 'blank') return `<div style="display:flex;align-items:center;height:26px;">${numHtml}</div>`;
        if (line.type === 'comment') return `<div style="display:flex;align-items:center;height:28px;">${numHtml}<span style="color:#6e7681;font-size:${Math.round(16 * shrink)}px;font-family:'Courier New',monospace;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${line.text}</span></div>`;
        if (line.type === 'bool') return `<div style="display:flex;align-items:center;height:28px;">${numHtml}<span style="color:#79c0ff;font-size:${Math.round(16 * shrink)}px;font-family:'Courier New',monospace;">${line.key}</span><span style="color:#e6edf3;font-size:${Math.round(16 * shrink)}px;font-family:'Courier New',monospace;">: </span><span style="color:#ff7b72;font-size:${Math.round(16 * shrink)}px;font-family:'Courier New',monospace;">${line.value}</span></div>`;
        return `<div style="display:flex;align-items:flex-start;min-height:28px;padding:2px 0;">${numHtml}<span style="color:#79c0ff;font-size:${Math.round(16 * shrink)}px;font-family:'Courier New',monospace;flex-shrink:0;">${line.key}</span><span style="color:#e6edf3;font-size:${Math.round(16 * shrink)}px;font-family:'Courier New',monospace;flex-shrink:0;">: </span><span style="color:${line.valColor};font-size:${Math.round(15 * shrink)}px;font-family:'Courier New',monospace;word-break:keep-all;line-height:1.45;${clampStyle(2)}flex:1;min-width:0;">&quot;${line.value}&quot;</span></div>`;
      };
      contentHtml = `
      <div style="width:100%;flex:1;min-height:180px;display:flex;flex-direction:column;gap:10px;overflow:hidden;margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
          <div style="font-size:20px;font-weight:700;color:#222;">⌨️ 바로 써보세요</div>
          <div style="background:#1a1a2e;color:#9b8eff;font-size:14px;font-weight:600;padding:4px 12px;border-radius:6px;white-space:nowrap;">CLAUDE.md</div>
        </div>
        <div style="flex:1;min-height:0;background:#0d1117;border-radius:14px;overflow:hidden;display:flex;flex-direction:column;">
          <div style="height:36px;background:#161b22;display:flex;align-items:center;padding:0 16px;gap:8px;flex-shrink:0;border-bottom:1px solid #21262d;">
            <div style="width:11px;height:11px;border-radius:50%;background:#ff5f57;"></div>
            <div style="width:11px;height:11px;border-radius:50%;background:#febc2e;"></div>
            <div style="width:11px;height:11px;border-radius:50%;background:#28c840;"></div>
            <div style="margin-left:10px;font-size:14px;color:#8b949e;font-family:'Courier New',monospace;">CLAUDE.md</div>
            <div style="margin-left:auto;width:7px;height:7px;border-radius:50%;background:#28c840;box-shadow:0 0 5px #28c840;"></div>
          </div>
          <div style="flex:1;padding:12px 12px 12px 0;overflow:hidden;display:flex;flex-direction:column;justify-content:center;gap:0;">
            ${codeLines.map(renderLine).join("")}
          </div>
        </div>
      </div>`;
    }

    return `
<div style="width:1080px;height:1350px;overflow:hidden;position:relative;background:#080814;
  display:flex;align-items:flex-start;justify-content:center;padding:44px 48px 0;
  font-family:'Noto Sans KR',sans-serif;flex-shrink:0;">
  ${bgLayer}
  <div style="width:984px;height:1258px;background:#fff;border-radius:20px;
    box-shadow:0 24px 80px rgba(0,0,0,.6);overflow:hidden;display:flex;
    flex-direction:column;position:relative;z-index:2;flex-shrink:0;">
    <div style="height:60px;background:#f4f4f4;border-bottom:1px solid #e0e0e0;
      display:flex;align-items:center;padding:0 22px;gap:14px;flex-shrink:0;">
      <div style="display:flex;gap:8px;">
        <div style="width:13px;height:13px;border-radius:50%;background:#ff5f57;"></div>
        <div style="width:13px;height:13px;border-radius:50%;background:#febc2e;"></div>
        <div style="width:13px;height:13px;border-radius:50%;background:#28c840;"></div>
      </div>
      <div style="flex:1;max-width:320px;height:32px;background:#e8e8e8;border-radius:8px;
        display:flex;align-items:center;justify-content:center;font-size:16px;color:#888;">insight</div>
    </div>
    <div style="height:1130px;overflow:hidden;padding:36px 52px 0;
      display:flex;flex-direction:column;align-items:center;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-shrink:0;">
        <div style="background:${accent};color:#fff;font-size:${Math.round(18 * shrink)}px;font-weight:700;
          padding:7px 18px;border-radius:8px;letter-spacing:.05em;">Chapter ${chNum}</div>
        <div style="background:#1a1a2e;color:${accent};font-family:'Courier New',monospace;
          font-size:${Math.round(16 * shrink)}px;padding:7px 14px;border-radius:8px;white-space:nowrap;overflow:hidden;">
          ${esc(topic.slice(0, 12))}
        </div>
      </div>
      <div style="font-size:${Math.round(52 * shrink)}px;font-weight:900;color:#111;text-align:center;
        margin-bottom:4px;word-break:keep-all;overflow:hidden;flex-shrink:0;line-height:1.1;">${esc(card.headline)}</div>
      ${pluginSub
        ? `<div style="font-size:${Math.round(22 * shrink)}px;font-weight:400;color:#666;text-align:center;
             margin-bottom:14px;word-break:keep-all;overflow:hidden;flex-shrink:0;">${esc(pluginSub)}</div>`
        : `<div style="margin-bottom:14px;flex-shrink:0;"></div>`}
    <div style="width:100%;background:linear-gradient(135deg,#1a1a2e,#16213e);
        border-radius:16px;padding:18px 24px;margin-bottom:16px;overflow:hidden;flex-shrink:0;">
        <div style="font-size:${Math.round(16 * shrink)}px;color:${accent};font-weight:700;letter-spacing:.08em;margin-bottom:8px;">✦ 핵심 가치</div>
        <div style="font-size:${Math.round(24 * shrink)}px;font-weight:700;color:#fff;line-height:1.45;
          word-break:keep-all;${clampStyle(2)}">${esc(summaryText)}</div>
      </div>
      ${contentHtml}
      <div style="width:100%;background:linear-gradient(90deg,#f0eeff,#e8e4ff);
        border:1.5px solid #c4b5fd;border-radius:12px;padding:12px 18px;
        margin-top:12px;margin-bottom:10px;
        display:flex;align-items:center;gap:12px;overflow:hidden;flex-shrink:0;">
        <span style="font-size:${Math.round(20 * shrink)}px;flex-shrink:0;">💡</span>
        <div style="font-size:${Math.round(20 * shrink)}px;color:#333;font-weight:600;word-break:keep-all;line-height:1.35;${clampStyle(2)}">${esc(effectText)}</div>
      </div>
    </div>
    <div style="position:absolute;bottom:0;right:0;left:0;height:68px;
      background:linear-gradient(90deg,rgba(20,20,40,.93),rgba(50,30,120,.93));
      display:flex;align-items:center;justify-content:flex-end;padding:0 32px;
      color:#fff;font-size:${Math.round(22 * shrink)}px;font-weight:500;white-space:nowrap;overflow:hidden;">
      ${teaserText} <span style="color:#c4b5fd;margin-left:6px;font-weight:700;">&gt;&gt;</span>
    </div>
  </div>
</div>`;
  });

  const CARD_HEAD = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box;margin:0;padding:0;}body{background:#111;}</style>
</head><body>`;

  // 개별 카드 HTML 배열 (미리보기용)
  buildPremiumTemplate._lastCardHtmls = blocks.map(
    (b) => `${CARD_HEAD}${b}</body></html>`
  );

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${esc(topic)} — 카드뉴스</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet">
<style>* { box-sizing:border-box; margin:0; padding:0; } body { background:#111; padding:20px; display:flex; flex-wrap:wrap; gap:16px; }</style>
</head>
<body>${blocks.join("\n")}</body>
</html>`;
}

// ── HIGHEST 스타일 템플릿 (cardnews_landing 시안 포팅) ──
// 디자인: Pretendard + 오렌지 강조 + 검정 알약 라벨 + 큰 헤드라인
// 컬러는 시안 디자인 정합성을 위해 #d97757 강제(color1 인자 무시).
// 모든 슬라이드에 imageUrl(AI 생성 배경)을 활용하며 part별로 다른 합성 방식 적용.
const HIGHEST_ACCENT = "#d97757";

export function buildHighestTemplate(topic, cards, brandName, _color1) {
  const brand = brandName || "브랜드";
  const esc = (s) =>
    String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // 두 줄 헤드라인 분할 — \n 우선, 없으면 띄어쓰기 기준 mid 가까운 곳에서
  const splitHeadline = (text) => {
    const t = String(text || "").trim();
    if (!t) return ["", ""];
    if (t.includes("\n")) {
      const parts = t.split("\n").map((s) => s.trim()).filter(Boolean);
      return [parts[0] || "", parts.slice(1).join(" ")];
    }
    if (t.length <= 14) return [t, ""];
    const mid = Math.floor(t.length / 2);
    const after = t.indexOf(" ", mid);
    const before = t.lastIndexOf(" ", mid);
    const cut = after !== -1 && (before === -1 || after - mid <= mid - before) ? after : before;
    if (cut === -1) return [t, ""];
    return [t.slice(0, cut).trim(), t.slice(cut + 1).trim()];
  };

  // 영문 라벨 — 한글 brand면 EN 약식 표기로 fallback
  const enLabel = (text) => {
    const ascii = String(text || "").replace(/[^A-Za-z0-9 ]/g, "").trim().toUpperCase();
    return ascii || "BRAND";
  };

  const renderBodyLines = (body, color) => {
    const lines = String(body || "").split(/\n+/).map((s) => s.trim()).filter(Boolean);
    if (!lines.length) return "";
    return lines.map((line) => `<p style="margin:0 0 14px 0;font-size:30px;font-weight:500;line-height:1.55;color:${color};">${esc(line)}</p>`).join("");
  };

  const bgImageStyle = (url) => url ? `background-image:url('${url}');background-size:cover;background-position:center;` : "";

  const renderCard = (card, i) => {
    const num = String(i + 1).padStart(2, "0");
    const isCover = card.part === "표지" || i === 0;
    const isClosing = card.part === "마무리" || i === cards.length - 1;
    const [head1, head2] = splitHeadline(card.headline);
    const brandEn = enLabel(brand);
    const img = card.imageUrl || "";

    if (isCover) {
      // 표지는 hook(작은 후크 1줄) + main(메인 카피 1~2줄) 두 부분. 모델이 \n으로 분리해서 보낸다.
      const hookLine = head2 ? head1 : "";
      const mainLine = head2 || head1;
      return `
      <article class="hslide hslide-cover" data-num="${num}">
        ${img ? `<div class="cover-bg" style="${bgImageStyle(img)}"></div><div class="cover-veil"></div>` : ""}
        <div class="orb orb-a"></div>
        <div class="orb orb-b"></div>
        <p class="cover-top">CARDNEWS · ${esc(brandEn)} · 2026</p>
        ${hookLine ? `<p class="cover-hook">${esc(hookLine)}</p>` : ""}
        <h1 class="cover-main">${esc(mainLine)}</h1>
        ${card.body ? `<p class="cover-sub">${esc(card.body)}</p>` : ""}
        <p class="cover-handle">@${esc(brandEn)}</p>
      </article>`;
    }

    if (isClosing) {
      return `
      <article class="hslide hslide-cta" data-num="${num}">
        ${img ? `<div class="cta-bg" style="${bgImageStyle(img)}"></div>` : ""}
        <div class="cta-overlay"></div>
        <div class="cta-inner">
          <span class="pill pill-dark"><span class="dot"></span>${esc(card.part || "마무리")}</span>
          <p class="cta-eyebrow">${esc(brand)} · 카드뉴스 마무리</p>
          <h2 class="cta-title">${esc(head1)}${head2 ? `<br/>${esc(head2)}` : ""}</h2>
          ${card.body ? `<div class="cta-box">${renderBodyLines(card.body, "#1c1c1f")}<p class="cta-handle">@${esc(brandEn)}</p></div>` : ""}
          <p class="cta-foot">${num} / ${String(cards.length).padStart(2, "0")} · ${esc(topic)}</p>
        </div>
      </article>`;
    }

    return `
      <article class="hslide hslide-body" data-num="${num}">
        ${img ? `<div class="body-hero" style="${bgImageStyle(img)}"><div class="body-hero-veil"></div></div>` : `<div class="body-hero body-hero-empty"></div>`}
        <div class="body-content">
          <span class="pill"><span class="dot"></span>#${num} ${esc(card.part || "본문")}</span>
          <h2 class="body-title">${esc(head1)}${head2 ? `<br/>${esc(head2)}` : ""}</h2>
          <div class="body-text">${renderBodyLines(card.body, "#3a3a3f")}</div>
          <p class="body-foot">출처 · @${esc(brandEn)} &nbsp;·&nbsp; ${num} / ${String(cards.length).padStart(2, "0")}</p>
        </div>
      </article>`;
  };

  const cardHtmls = cards.map((card, i) => {
    const inner = renderCard(card, i);
    return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<link rel="stylesheet" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css" />
<style>${HIGHEST_STYLE()}</style></head>
<body>${inner}</body></html>`;
  });

  buildHighestTemplate._lastCardHtmls = cardHtmls;

  const previewBlocks = cards.map((card, i) => renderCard(card, i)).join("\n");
  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<title>${esc(topic)} — 카드뉴스</title>
<link rel="stylesheet" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css" />
<style>
  body { margin:0; padding:24px; background:#ececef; display:flex; flex-wrap:wrap; gap:20px; justify-content:center; }
  ${HIGHEST_STYLE()}
</style></head>
<body>${previewBlocks}</body></html>`;
}

function HIGHEST_STYLE() {
  const accent = HIGHEST_ACCENT;
  return `
  * { box-sizing:border-box; margin:0; padding:0;
      font-family:'Pretendard Variable', Pretendard, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
      -webkit-font-smoothing:antialiased; }
  .hslide { width:1080px; height:1350px; position:relative; overflow:hidden; display:flex; flex-direction:column; }

  /* ── COVER ── */
  .hslide-cover { background:#0a0a0c; color:#fff; align-items:center; justify-content:center; text-align:center; padding:90px 80px; }
  .hslide-cover .cover-bg { position:absolute; inset:0; opacity:0.45; filter:saturate(0.85); z-index:0; }
  .hslide-cover .cover-veil { position:absolute; inset:0; z-index:1;
                              background:radial-gradient(ellipse at center, rgba(10,10,12,0.55) 0%, rgba(10,10,12,0.92) 70%, #0a0a0c 100%); }
  .hslide-cover .orb { position:absolute; border-radius:50%; filter:blur(90px); pointer-events:none; z-index:1; }
  .hslide-cover .orb-a { width:620px; height:620px; left:-160px; top:-120px; background:${accent}; opacity:0.42; }
  .hslide-cover .orb-b { width:520px; height:520px; right:-120px; bottom:-160px; background:#57b9d9; opacity:0.22; }
  .hslide-cover .cover-top { position:relative; z-index:2; font-size:22px; letter-spacing:0.4em; color:${accent}; font-weight:700; margin-bottom:48px; }
  .hslide-cover .cover-hook { position:relative; z-index:2; font-size:38px; font-weight:600; color:rgba(255,255,255,0.86);
                              letter-spacing:-0.01em; margin-bottom:28px; max-width:880px; line-height:1.35; }
  .hslide-cover .cover-main { position:relative; z-index:2; font-size:104px; font-weight:900; line-height:1.12;
                              color:#fff; letter-spacing:-0.035em; max-width:940px;
                              filter:drop-shadow(0 14px 30px rgba(0,0,0,0.4)); }
  .hslide-cover .cover-sub { position:relative; z-index:2; margin-top:40px; font-size:30px; color:rgba(255,255,255,0.78); font-weight:500; line-height:1.5; max-width:820px; }
  .hslide-cover .cover-handle { position:absolute; bottom:60px; left:0; right:0; text-align:center; z-index:2;
                                font-size:22px; letter-spacing:0.32em; color:rgba(255,255,255,0.6); font-weight:600; }

  /* ── BODY ── */
  .hslide-body { background:#fdfdfd; color:#1c1c1f; }
  .hslide-body .body-hero { position:relative; width:100%; height:480px; overflow:hidden; }
  .hslide-body .body-hero-empty { background:linear-gradient(135deg, #fef2eb 0%, #fad9c6 100%); }
  .hslide-body .body-hero-veil { position:absolute; inset:0; background:linear-gradient(to bottom, transparent 55%, #fdfdfd 100%); }
  .hslide-body .body-content { flex:1; padding:48px 80px 60px 80px; display:flex; flex-direction:column; }
  .pill { display:inline-flex; align-items:center; gap:10px;
          background:#1c1c1f; color:#fff; padding:10px 24px; border-radius:999px;
          font-size:22px; font-weight:700; align-self:flex-start; }
  .pill .dot { width:10px; height:10px; border-radius:50%; background:${accent}; }
  .hslide-body .body-title { font-size:72px; font-weight:900; line-height:1.18;
                             letter-spacing:-0.025em; color:#1c1c1f; margin:36px 0 40px 0; }
  .hslide-body .body-text { flex:1; }
  .hslide-body .body-foot { font-size:20px; letter-spacing:0.18em; color:#8b8b90; font-weight:600; margin-top:30px; }

  /* ── CTA ── */
  .hslide-cta { color:#fff; padding:0; }
  .hslide-cta .cta-bg { position:absolute; inset:0; opacity:0.4; filter:saturate(1.05); }
  .hslide-cta .cta-overlay { position:absolute; inset:0; background:linear-gradient(150deg, #f0a06b 0%, ${accent} 55%, #9c4d35 100%); mix-blend-mode:multiply; }
  .hslide-cta .cta-inner { position:relative; z-index:2; display:flex; flex-direction:column; height:100%; align-items:center; text-align:center; padding:90px 80px; }
  .hslide-cta .pill-dark { background:#0a0a0c; color:#fff; align-self:center; }
  .hslide-cta .cta-eyebrow { margin-top:28px; font-size:20px; letter-spacing:0.34em; color:rgba(255,255,255,0.9); font-weight:600; }
  .hslide-cta .cta-title { margin-top:30px; font-size:82px; font-weight:900; line-height:1.1;
                            letter-spacing:-0.03em; color:#fff; }
  .hslide-cta .cta-box { margin-top:48px; background:#fff; border-radius:24px; padding:42px 52px;
                         box-shadow:0 24px 60px rgba(0,0,0,0.25); max-width:820px; }
  .hslide-cta .cta-box p { color:#1c1c1f; }
  .hslide-cta .cta-handle { margin-top:14px !important; font-size:22px !important;
                            letter-spacing:0.28em !important; color:${accent} !important; font-weight:700 !important; }
  .hslide-cta .cta-foot { margin-top:auto; padding-top:30px; font-size:18px; letter-spacing:0.24em; color:rgba(255,255,255,0.78); font-weight:600; }
  `;
}
