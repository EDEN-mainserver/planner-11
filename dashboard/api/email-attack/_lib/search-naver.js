// 컴포넌트 1-b: 네이버 검색 (공식 API — Playwright 불필요)
// 반환 형식: [{rank, url, domain, title, snippet, source: 'naver'}]
//
// 네이버 검색 API는 종류별로 endpoint 다름:
// - webkr (웹문서) — 회사 홈페이지 잘 잡힘
// - shop (쇼핑) — 자사몰 잡힘
// - encyc, news, blog, cafearticle 등
//
// 우리는 webkr + shop 두 개 합쳐 사용. 둘 다 회사·브랜드 위주.

import { isInfoDomain, domainOf } from "./blocklist.js";

async function _callNaverApi(endpoint, query, display = 30) {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수 미설정");
  }

  const url = `https://openapi.naver.com/v1/search/${endpoint}.json?query=${encodeURIComponent(query)}&display=${display}`;
  const res = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
  });
  if (!res.ok) {
    throw new Error(`네이버 API ${endpoint} ${res.status}`);
  }
  const data = await res.json();
  return data.items || [];
}

// HTML 태그 제거 (네이버 API가 <b> 태그로 검색어 강조)
function stripTags(s) {
  return (s || "").replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, "");
}


export async function searchNaver({ keyword, topN = 10 }) {
  const allCandidates = [];

  // 1) 웹 검색
  try {
    const webItems = await _callNaverApi("webkr", keyword, 30);
    for (const item of webItems) {
      allCandidates.push({
        url: item.link,
        title: stripTags(item.title),
        snippet: stripTags(item.description),
        kind: "naver_web",
      });
    }
  } catch (e) {
    console.error("[naver webkr 실패]", e.message);
  }

  // 2) 쇼핑 검색 — 자사몰 발굴에 강함
  try {
    const shopItems = await _callNaverApi("shop", keyword, 30);
    for (const item of shopItems) {
      const link = item.link; // 보통 smartstore.naver.com 또는 셀러 자사몰
      if (!link) continue;
      allCandidates.push({
        url: link,
        title: stripTags(item.title),
        snippet: stripTags(item.mallName || item.brand || ""),
        kind: "naver_shop",
      });
    }
  } catch (e) {
    console.error("[naver shop 실패]", e.message);
  }

  // 필터 + dedupe
  const seen = new Set();
  const filtered = [];
  for (const c of allCandidates) {
    const dom = domainOf(c.url);
    if (!dom || isInfoDomain(dom) || dom === "naver.com") continue;
    if (seen.has(dom)) continue;
    seen.add(dom);
    filtered.push({
      url: c.url,
      domain: dom,
      title: c.title,
      snippet: c.snippet,
      kind: c.kind,
      source: "naver",
      rank: filtered.length + 1,
    });
    if (filtered.length >= topN) break;
  }
  return filtered;
}
