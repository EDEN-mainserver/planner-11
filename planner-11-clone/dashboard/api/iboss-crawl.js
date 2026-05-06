// Vercel Serverless Function — 아이보스 월간 인기글 크롤러
// httpx 대신 fetch로 크롤링, cheerio 대신 정규식 파싱

function parseIbossHtml(html, maxPosts) {
  const posts = [];
  // <tr> 행 추출
  const trRegex = /<tr\s+class="is_notice_"[\s\S]*?<\/tr>/gi;
  let match;
  let rank = 1;

  while ((match = trRegex.exec(html)) !== null && rank <= maxPosts) {
    const row = match[0];

    // 순번
    const rankMatch = row.match(/<span class="snum[^"]*">(\d+)<\/span>/);
    if (!rankMatch) continue;

    // 제목 + 링크
    const titleMatch = row.match(/<a\s+href="([^"]*)"[^>]*title="([^"]*)"/);
    if (!titleMatch) continue;
    const href = titleMatch[1];
    const title = titleMatch[2];

    // 댓글수
    const commMatch = row.match(/<span class="AB-comm">(\d+)<\/span>/);
    const comments = commMatch ? parseInt(commMatch[1]) : 0;

    // 작성자
    const authorMatch = row.match(/<p class="mb_writer"[^>]*>\s*(?:<[^>]*>)*\s*([^<]+)/);
    const author = authorMatch ? authorMatch[1].trim() : "";

    // td 에서 날짜, 좋아요, 조회수 추출 (3번째, 4번째, 5번째 td)
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const tds = [];
    let tdMatch;
    while ((tdMatch = tdRegex.exec(row)) !== null) {
      const text = tdMatch[1].replace(/<[^>]+>/g, "").trim();
      tds.push(text);
    }

    const createdAt = tds[3] || "";
    const likes = parseInt((tds[4] || "0").replace(/,/g, "")) || 0;
    const views = parseInt((tds[5] || "0").replace(/,/g, "")) || 0;

    const sourceUrl = href.startsWith("http")
      ? href
      : `https://www.i-boss.co.kr${href}`;

    posts.push({
      rank: rank++,
      title,
      content_raw: "",
      author,
      views,
      likes,
      comments,
      shares: 0,
      image_url: "",
      source_url: sourceUrl,
      created_at: createdAt,
      platform: "iboss",
    });
  }

  return posts;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { month, limit = "50", detail, url: detailUrl } = req.query;

  // ── fr-view div 깊이 기반 추출 (중첩 태그 지원) ──
  function extractFrView(html) {
    // fr-view 위치 탐색
    const marker = 'class="fr-view"';
    const markerIdx = html.indexOf(marker);
    if (markerIdx === -1) return "";

    // 여는 > 위치
    const openEnd = html.indexOf('>', markerIdx) + 1;

    // div 깊이 카운팅으로 닫는 태그 찾기
    let depth = 1;
    let pos = openEnd;
    while (pos < html.length && depth > 0) {
      const nextOpen  = html.indexOf('<div', pos);
      const nextClose = html.indexOf('</div>', pos);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        pos = nextOpen + 4;
      } else {
        depth--;
        if (depth === 0) {
          const inner = html.slice(openEnd, nextClose);
          return inner
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        }
        pos = nextClose + 6;
      }
    }
    return "";
  }

  // ── 상세 본문 크롤링 모드 ──
  if (detail === "true" && detailUrl) {
    try {
      const mainResp = await fetch("https://www.i-boss.co.kr/", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "ko-KR,ko;q=0.9",
        },
      });
      const cookies = mainResp.headers.getSetCookie?.() || [];
      const cookieStr = cookies.map((c) => c.split(";")[0]).join("; ");

      const resp = await fetch(detailUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "ko-KR,ko;q=0.9",
          "Referer": "https://www.i-boss.co.kr/",
          "Cookie": cookieStr,
        },
      });
      const html = await resp.text();

      // 방법 1: fr-view 깊이 카운팅 추출
      let content = extractFrView(html);

      // 방법 2: fr-view 못 찾으면 article_content, post_content 등 대체 시도
      if (!content) {
        const altPatterns = [
          /id="article_content"[^>]*>([\s\S]*?)<\/div>/,
          /class="post_content[^"]*"[^>]*>([\s\S]{20,}?)<\/div>/,
          /class="view_content[^"]*"[^>]*>([\s\S]{20,}?)<\/div>/,
          /class="content[^"]*"[^>]*>([\s\S]{20,}?)<\/div>/,
        ];
        for (const pat of altPatterns) {
          const m = html.match(pat);
          if (m?.[1]) {
            const candidate = m[1]
              .replace(/<br\s*\/?>/gi, '\n')
              .replace(/<\/p>/gi, '\n')
              .replace(/<[^>]+>/g, '')
              .replace(/&nbsp;/g, ' ')
              .replace(/\n{3,}/g, '\n\n')
              .trim();
            if (candidate.length > 20) { content = candidate; break; }
          }
        }
      }

      return res.status(200).json({ content, error: content ? "" : "본문 영역을 찾을 수 없습니다" });
    } catch (e) {
      return res.status(200).json({ content: "", error: e.message });
    }
  }

  // ── 목록 크롤링 모드 ──
  const maxPosts = parseInt(limit) || 50;
  const targetMonth = month || new Date().toISOString().slice(0, 7).replace("-", "");

  try {
    // 1) 메인 페이지 방문 → 쿠키 획득
    const mainResp = await fetch("https://www.i-boss.co.kr/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept-Language": "ko-KR,ko;q=0.9",
      },
    });
    // 쿠키 전달
    const cookies = mainResp.headers.getSetCookie?.() || [];
    const cookieStr = cookies.map((c) => c.split(";")[0]).join("; ");

    // 2) 인기글 페이지 크롤링
    const url = `https://www.i-boss.co.kr/ab-1886?month=${targetMonth}`;
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept-Language": "ko-KR,ko;q=0.9",
        "Referer": "https://www.i-boss.co.kr/",
        "Cookie": cookieStr,
      },
    });

    if (!resp.ok) {
      return res.status(200).json({ platform: "iboss", total: 0, posts: [], error: `HTTP ${resp.status}` });
    }

    const html = await resp.text();
    const posts = parseIbossHtml(html, maxPosts);

    return res.status(200).json({
      platform: "iboss",
      total: posts.length,
      posts,
      error: "",
    });
  } catch (e) {
    return res.status(200).json({
      platform: "iboss",
      total: 0,
      posts: [],
      error: e.message || "크롤링 실패",
    });
  }
}
