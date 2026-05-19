// 외부 인기글 수집 cron.
// Vercel cron: 0 *\/12 * * *  (12시간마다)
// 흐름: 각 사용자별 threads-auto-config keywords → 키워드별 threads-crawl + x-crawl 내부 호출 → external_trending upsert
// 전제: THREADS_COOKIES, X_COOKIES env 등록되어 있어야 결과 있음. 미등록이면 크롤은 빈 결과 (휴면).

import { list } from "@vercel/blob";
import {
  upsertExternalTrending,
  pruneOldExternalTrending,
} from "./_external-trending-storage.js";

export const config = { maxDuration: 300, memory: 1024 };

const MAX_KEYWORDS_PER_USER = 3;
const CRAWL_TIMEOUT_MS = 55000;
const BLOB_FETCH_TIMEOUT_MS = 8000;

function getSelfOrigin() {
  const v = process.env.VERCEL_URL;
  return v ? `https://${v}` : "https://planforge-ui.vercel.app";
}

async function readAutoConfig(prefix, username) {
  try {
    const { blobs } = await list({ prefix: `${prefix}/${username}.json` });
    if (!blobs.length) return null;
    const latest = [...blobs].sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0))[0];
    const res = await fetch(latest.url, {
      cache: "no-store",
      signal: AbortSignal.timeout(BLOB_FETCH_TIMEOUT_MS),
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

async function listAllAutoConfigUsernames() {
  // threads-auto와 instagram-auto blob 둘 다에서 사용자 username 수집
  const usernames = new Set();
  for (const prefix of ["threads-auto", "instagram-auto"]) {
    try {
      const { blobs } = await list({ prefix: `${prefix}/` });
      for (const b of blobs) {
        const name = b.pathname.replace(`${prefix}/`, "").replace(/\.json$/, "");
        if (name && !name.includes("/")) usernames.add(name);
      }
    } catch {}
  }
  return [...usernames];
}

function pickKeywords(config) {
  const raw = Array.isArray(config?.keywords)
    ? config.keywords
    : String(config?.keywords || "")
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
  // 셔플 후 상위 N개 — 매번 다른 키워드 조합으로 크롤
  const shuffled = [...new Set(raw)].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, MAX_KEYWORDS_PER_USER);
}

async function crawlOne(path, keyword) {
  try {
    const res = await fetch(`${getSelfOrigin()}${path}`, {
      method: "POST",
      signal: AbortSignal.timeout(CRAWL_TIMEOUT_MS),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.posts) ? data.posts : [];
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers["authorization"];
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const summary = {
    startedAt: new Date().toISOString(),
    users: [],
    insertedTotal: 0,
    pruned: 0,
  };

  try {
    const usernames = await listAllAutoConfigUsernames();
    for (const username of usernames) {
      // threads-auto config 우선, 없으면 instagram-auto
      const threadsConfig = await readAutoConfig("threads-auto", username);
      const igConfig = await readAutoConfig("instagram-auto", username);
      const config = threadsConfig || igConfig;
      if (!config?.enabled) continue;
      const keywords = pickKeywords(config);
      if (!keywords.length) continue;

      const userStat = { username, keywords, threadsInserted: 0, xInserted: 0 };

      for (const keyword of keywords) {
        // platform 병렬 호출
        const [threadsPosts, xPosts] = await Promise.all([
          crawlOne("/api/threads-crawl", keyword),
          crawlOne("/api/x-crawl", keyword),
        ]);

        if (threadsPosts.length) {
          try {
            const r = await upsertExternalTrending(username, "threads", keyword, threadsPosts);
            userStat.threadsInserted += r.inserted;
            summary.insertedTotal += r.inserted;
          } catch (err) {
            userStat.error = err.message;
          }
        }
        if (xPosts.length) {
          try {
            const r = await upsertExternalTrending(username, "x", keyword, xPosts);
            userStat.xInserted += r.inserted;
            summary.insertedTotal += r.inserted;
          } catch (err) {
            userStat.error = err.message;
          }
        }
      }

      summary.users.push(userStat);
    }

    // 7일 이상된 행 정리
    summary.pruned = await pruneOldExternalTrending();
    summary.finishedAt = new Date().toISOString();
    return res.status(200).json({ ok: true, summary });
  } catch (err) {
    return res.status(500).json({ error: err.message, summary });
  }
}
