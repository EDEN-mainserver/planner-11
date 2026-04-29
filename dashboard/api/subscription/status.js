import { put, list } from "@vercel/blob";

const INTERNAL_USERS = ["eden", "user2", "user3", "user4"];
const BLOB_PREFIX = "subscriptions";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function getSubscription(userId) {
  const path = `${BLOB_PREFIX}/${userId}.json`;
  const { blobs } = await list({ prefix: path });
  if (!blobs.length) return null;
  const resp = await fetch(blobs[0].url);
  if (!resp.ok) return null;
  return await resp.json();
}

async function saveSubscription(data) {
  const path = `${BLOB_PREFIX}/${data.userId}.json`;
  await put(path, JSON.stringify(data, null, 2), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
  });
}

function defaultPremium(userId) {
  const now = new Date();
  const end = new Date(now);
  end.setFullYear(end.getFullYear() + 10);
  return {
    userId,
    planId: "premium",
    status: "active",
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: end.toISOString(),
    usageCount: 0,
    usageResetAt: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
  };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const userId = req.method === "GET"
    ? req.query.userId
    : req.body?.userId;

  if (!userId) return res.status(400).json({ error: "userId 필요" });

  if (req.method === "GET") {
    if (INTERNAL_USERS.includes(userId)) {
      return res.status(200).json(defaultPremium(userId));
    }
    const sub = await getSubscription(userId);
    if (!sub) return res.status(404).json({ error: "구독 정보 없음" });
    return res.status(200).json(sub);
  }

  if (req.method === "POST") {
    const { planId, status, currentPeriodStart, currentPeriodEnd } = req.body;
    const now = new Date();
    const data = {
      userId,
      planId: planId || "basic",
      status: status || "active",
      currentPeriodStart: currentPeriodStart || now.toISOString(),
      currentPeriodEnd: currentPeriodEnd || new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString(),
      usageCount: 0,
      usageResetAt: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
    };
    const existing = await getSubscription(userId);
    if (existing) {
      data.usageCount = existing.usageCount || 0;
      data.usageResetAt = existing.usageResetAt || data.usageResetAt;
    }
    await saveSubscription(data);
    return res.status(200).json({ ok: true, subscription: data });
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}
