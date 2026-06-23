// 컴포넌트 1-a: 구글 검색 (SerpAPI)
// 반환 형식: [{rank, url, domain, title, snippet, source: 'google'}]

import { isInfoDomain, domainOf } from "./blocklist.js";

const SERPAPI_BASE = "https://serpapi.com/search.json";

export async function searchGoogle({
  keyword,
  topN = 10,
  region = "kr",
  language = "ko",
}) {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    throw new Error("SERPAPI_KEY 환경변수가 설정되지 않았습니다");
  }

  const params = new URLSearchParams({
    engine: "google",
    q: keyword,
    gl: region,
    hl: language,
    num: String(topN * 2), // 매체 필터로 줄어들 것을 감안
    api_key: apiKey,
  });

  const res = await fetch(`${SERPAPI_BASE}?${params}`, { method: "GET" });
  if (!res.ok) {
    throw new Error(`SerpAPI ${res.status}`);
  }
  const data = await res.json();

  const candidates = [];

  // 광고 슬롯
  for (const key of ["ads", "bottom_ads", "shopping_results"]) {
    for (const r of data[key] || []) {
      const link = r.link || r.source;
      if (!link) continue;
      candidates.push({
        url: link,
        domain: domainOf(link),
        title: r.title || "",
        snippet: r.snippet || r.description || "",
        kind: key,
      });
    }
  }

  // 오가닉
  for (const r of data.organic_results || []) {
    if (!r.link) continue;
    candidates.push({
      url: r.link,
      domain: domainOf(r.link),
      title: r.title || "",
      snippet: r.snippet || "",
      kind: "organic",
    });
  }

  // 필터 + dedupe
  const seen = new Set();
  const filtered = [];
  for (const c of candidates) {
    if (!c.domain || isInfoDomain(c.domain)) continue;
    if (seen.has(c.domain)) continue;
    seen.add(c.domain);
    filtered.push({
      ...c,
      source: "google",
      rank: filtered.length + 1,
    });
    if (filtered.length >= topN) break;
  }
  return filtered;
}
