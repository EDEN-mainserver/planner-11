// E-MAIL Attack 도메인 차단리스트
// - 매체·포털·SNS·대형쇼핑몰 등 영업 타겟이 아닌 도메인 자동 제외
// - 어제 Python eden-outreach 에서 검증한 리스트 그대로 포팅

export const INFO_DOMAIN_BLOCKLIST = new Set([
  // 포털·검색
  "naver.com", "daum.net", "google.com", "bing.com", "yahoo.com",
  // 블로그·UGC
  "tistory.com", "brunch.co.kr", "blog.me", "post.naver.com",
  "medium.com", "wordpress.com", "blogspot.com",
  // 카페·커뮤니티
  "cafe.naver.com", "dcinside.com", "fmkorea.com", "ruliweb.com",
  "ppomppu.co.kr", "todayhumor.co.kr", "instiz.net", "theqoo.net",
  "clien.net", "mlbpark.donga.com",
  // SNS
  "youtube.com", "youtu.be", "instagram.com", "facebook.com",
  "twitter.com", "x.com", "tiktok.com", "linkedin.com",
  "pinterest.com", "reddit.com", "threads.net",
  // 대형 쇼핑몰·마켓플레이스
  "coupang.com", "11st.co.kr", "gmarket.co.kr", "auction.co.kr",
  "interpark.com", "tmon.co.kr", "wemakeprice.com", "ssg.com",
  "shinsegaemall.ssg.com", "lotteon.com", "ohou.se", "kream.co.kr",
  "musinsa.com", "zigzag.kr", "29cm.co.kr", "wadiz.kr", "tumblbug.com",
  "amazon.com", "ebay.com", "aliexpress.com", "etsy.com",
  "oliveyoung.co.kr", "lalavla.gsretail.com",
  // 뉴스·매체
  "news.naver.com", "news.daum.net", "yna.co.kr", "yonhapnews.co.kr",
  "chosun.com", "donga.com", "joongang.co.kr", "hani.co.kr",
  "khan.co.kr", "ohmynews.com", "pressian.com", "edaily.co.kr",
  "mt.co.kr", "mk.co.kr", "hankyung.com", "hankookilbo.com",
  "seoul.co.kr", "kookmin.co.kr", "newsis.com", "newdaily.co.kr",
  "ytn.co.kr", "mbn.co.kr", "sbs.co.kr", "kbs.co.kr",
  "cosinkorea.com", "thebeautynews.com", "the-pr.co.kr",
  // 스타트업 DB·VC 매체
  "thevc.kr", "innoforest.co.kr", "nextunicorn.kr", "unicornfactory.co.kr",
  "platum.kr", "venturesquare.net", "bemypet.com", "kakao.vc",
  "ddaily.co.kr", "outstanding.kr", "techcrunch.com",
  // 브랜드 분석·리포트·뉴스레터 플랫폼
  "brikorea.com", "fortunebusinessinsights.com", "marketresearch.com",
  "statista.com", "maily.so", "stibee.com", "substack.com",
  // 추가 뉴스 매체
  "ktnews.com", "tnnews.co.kr", "beautynury.com", "cncnews.co.kr",
  "thebeautynews.com", "businesspost.co.kr", "newspim.com",
  "hansbiz.co.kr", "ksilbo.co.kr", "sportsseoul.com", "sportschosun.com",
  "marieclairekorea.com", "dizzo.com", "asiatime.co.kr", "k-health.com",
  "biotimes.co.kr", "woodkorea.co.kr", "youthassembly.kr",
  "news1.kr", "nocutnews.co.kr",
  "dailyvet.co.kr", "lawissue.co.kr", "youthdaily.co.kr",
  // 위키·지식·지도
  "wikipedia.org", "namu.wiki", "kin.naver.com", "openstreetmap.org",
]);


export function isInfoDomain(domain) {
  if (!domain) return false;
  const d = domain.toLowerCase();
  if (INFO_DOMAIN_BLOCKLIST.has(d)) return true;
  for (const blocked of INFO_DOMAIN_BLOCKLIST) {
    if (d.endsWith("." + blocked)) return true;
  }
  // 정부·공공 (.go.kr, .or.kr)
  if (d.endsWith(".go.kr") || d.endsWith(".or.kr")) return true;
  return false;
}


// URL → root domain ("a.b.brand.co.kr" → "brand.co.kr")
// 의존성 없이 간단한 추출 (tldextract 라이브러리 대체)
const KR_2LD = new Set(["co", "or", "go", "ne", "re", "pe", "ac", "hs", "ms", "es", "sc"]);

export function domainOf(urlOrHost) {
  try {
    let host = urlOrHost;
    if (host.includes("://")) host = new URL(host).hostname;
    host = host.toLowerCase().replace(/^www\./, "");
    const parts = host.split(".");
    if (parts.length <= 2) return host;
    // 한국 도메인 예외 (xxx.co.kr, xxx.go.kr 등)
    const last = parts[parts.length - 1];
    const second = parts[parts.length - 2];
    if (last === "kr" && KR_2LD.has(second)) {
      return parts.slice(-3).join(".");
    }
    return parts.slice(-2).join(".");
  } catch {
    return urlOrHost;
  }
}
