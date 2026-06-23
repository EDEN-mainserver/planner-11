// 컴포넌트 2: 이메일 + 상호명 추출 (httpx 대신 native fetch)
// - 사이트 메인 + /contact, /about, /ko, /en 순회
// - mailto: 링크 + 정규식 매칭
// - og:site_name 또는 <title> = 상호명

const COMMON_PATHS = ["", "/contact", "/contact-us", "/about", "/about-us", "/ko", "/en", "/support"];

const EMAIL_REGEX = /(?<![A-Za-z0-9._%+-])[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const EMAIL_BLOCKLIST = new Set([
  "example@example.com", "your@email.com", "name@email.com",
  "info@example.com", "email@example.com", "user@example.com",
  "no-reply@example.com", "noreply@example.com",
]);

const BAD_TLDS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".pdf"];

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36";

const FETCH_TIMEOUT_MS = 12000;


async function fetchHtml(url) {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(t);
    const ct = res.headers.get("content-type") || "";
    if (!res.ok || !ct.includes("html")) return null;
    return await res.text();
  } catch {
    return null;
  }
}


function cleanEmails(found) {
  const cleaned = [];
  for (let e of found) {
    // \u00xx prefix 제거 (HTML 이스케이프 깨진 경우)
    const m1 = e.match(/^u00[0-9a-fA-F]{2}(.+)$/);
    if (m1) e = m1[1];
    // 비-영숫자 prefix 제거
    e = e.replace(/^[^A-Za-z0-9]+/, "");
    cleaned.push(e);
  }
  const out = [];
  const seen = new Set();
  for (let e of cleaned) {
    e = e.trim().toLowerCase();
    if (!e || seen.has(e) || EMAIL_BLOCKLIST.has(e)) continue;
    if (BAD_TLDS.some((t) => e.endsWith(t))) continue;
    if (e.startsWith(".") || e.startsWith("-")) continue;
    if ((e.match(/@/g) || []).length !== 1) continue;
    seen.add(e);
    out.push(e);
  }
  return out;
}


function extractEmailsFromHtml(html) {
  const found = [];

  // 1) mailto:
  const mailtoRegex = /<a[^>]+href=["']mailto:([^"'?]+)/gi;
  let m;
  while ((m = mailtoRegex.exec(html)) !== null) {
    found.push(m[1]);
  }

  // 2) 본문 정규식 (script/style 포함 — JS에 박힌 이메일도 잡음)
  const regexMatches = html.match(EMAIL_REGEX) || [];
  found.push(...regexMatches);

  return found;
}


function extractBrandName(html) {
  // og:site_name
  let m = html.match(/<meta\s+(?:property|name)=["']og:site_name["'][^>]*content=["']([^"']+)/i);
  if (m) return m[1].trim().slice(0, 40);
  m = html.match(/<meta\s+(?:property|name)=["']og:title["'][^>]*content=["']([^"']+)/i);
  if (m) return m[1].trim().slice(0, 40);
  // <title>
  m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (m) return m[1].trim().slice(0, 40);
  return "";
}


function detectLanguage(html) {
  // 간단 휴리스틱: 한글 비율로 판단
  const text = html.replace(/<[^>]+>/g, " ").slice(0, 2000);
  const koCount = (text.match(/[가-힣]/g) || []).length;
  const enCount = (text.match(/[a-zA-Z]{4,}/g) || []).length;
  if (koCount > enCount * 0.3) return "ko";
  return "en";
}


function decodeEntities(text) {
  return String(text || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}


function cleanText(text, max = 900) {
  return decodeEntities(text)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}


function pickMeta(html, name) {
  const re = new RegExp(`<meta\\s+(?:name|property)=["']${name}["'][^>]*content=["']([^"']+)`, "i");
  return cleanText((html.match(re) || [])[1] || "", 300);
}


function extractSummary(html) {
  const desc =
    pickMeta(html, "description") ||
    pickMeta(html, "og:description") ||
    pickMeta(html, "twitter:description");
  const h1 = cleanText((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]?.replace(/<[^>]+>/g, " ") || "", 180);
  const body = cleanText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " "),
    700
  );

  return [desc && `소개: ${desc}`, h1 && `대표 문구: ${h1}`, body && `본문 단서: ${body}`]
    .filter(Boolean)
    .join("\n")
    .slice(0, 1200);
}


// 메인 export: 도메인 1개 → {brand_name, emails, language, homepage_url}
export async function extractFromDomain(domain) {
  const baseUrl = domain.startsWith("http") ? domain : `https://${domain}`;

  let brand = "";
  let language = "";
  let allEmails = [];
  let firstHtml = null;

  // 메인 페이지 + 흔한 연락 페이지 5개 병렬 fetch
  const pages = COMMON_PATHS.map((p) => `${baseUrl}${p.startsWith("/") ? p : "/" + p}`.replace(/\/+$/, "/"));
  const htmls = await Promise.all(pages.map(fetchHtml));

  for (let i = 0; i < htmls.length; i++) {
    const html = htmls[i];
    if (!html) continue;
    if (!firstHtml) firstHtml = html;
    const emails = extractEmailsFromHtml(html);
    allEmails.push(...emails);
    // 이메일 5개 이상 모이면 충분
    if (cleanEmails(allEmails).length >= 5) break;
  }

  if (firstHtml) {
    brand = extractBrandName(firstHtml);
    language = detectLanguage(firstHtml);
  }

  return {
    homepage_url: baseUrl,
    brand_name: brand,
    language: language || "ko",
    summary: firstHtml ? extractSummary(firstHtml) : "",
    emails: cleanEmails(allEmails),
  };
}
