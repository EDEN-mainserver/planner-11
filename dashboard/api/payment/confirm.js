import { put, list, del } from "@vercel/blob";

const PLANS = {
  basic:    { price: 9900 },
  standard: { price: 29900 },
  premium:  { price: 79900 },
};
const PLAN_LIMITS = { basic: 20, standard: 80, premium: 200 };

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function verifyPortOne(paymentId) {
  const apiSecret = process.env.PORTONE_API_SECRET;
  if (!apiSecret) throw new Error("PORTONE_API_SECRET 환경변수 없음");
  const resp = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `PortOne ${apiSecret}` },
  });
  if (!resp.ok) throw new Error(`PortOne 조회 실패: ${resp.status}`);
  return await resp.json();
}

async function getPending(paymentId) {
  const { blobs } = await list({ prefix: `payment-pending/${paymentId}.json` });
  if (!blobs.length) return null;
  const resp = await fetch(blobs[0].url);
  return resp.ok ? await resp.json() : null;
}

async function saveSubscription(userId, planId) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const resetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const existing = await getSubscription(userId);
  const usageCount = existing?.usageCount || 0;

  const data = {
    userId,
    planId,
    status: "active",
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: end.toISOString(),
    usageCount,
    usageResetAt: resetAt.toISOString(),
    updatedAt: now.toISOString(),
  };
  await put(`subscriptions/${userId}.json`, JSON.stringify(data, null, 2), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
  });
  return data;
}

async function getSubscription(userId) {
  const { blobs } = await list({ prefix: `subscriptions/${userId}.json` });
  if (!blobs.length) return null;
  const resp = await fetch(blobs[0].url);
  return resp.ok ? await resp.json() : null;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { paymentId } = req.body || {};
  if (!paymentId) return res.status(400).json({ error: "paymentId 필요" });

  const pending = await getPending(paymentId);
  if (!pending) return res.status(404).json({ error: "결제 정보 없음" });

  let payment;
  try {
    payment = await verifyPortOne(paymentId);
  } catch (e) {
    return res.status(502).json({ error: "PortOne 검증 실패: " + e.message });
  }

  const expectedAmount = PLANS[pending.planId]?.price;
  if (!expectedAmount) return res.status(400).json({ error: "유효하지 않은 플랜" });

  if (payment.status !== "PAID" || payment.amount?.total !== expectedAmount) {
    return res.status(400).json({
      error: "결제 금액 불일치 또는 미완료",
      status: payment.status,
      paid: payment.amount?.total,
      expected: expectedAmount,
    });
  }

  const subscription = await saveSubscription(pending.userId, pending.planId);

  const { blobs } = await list({ prefix: `payment-pending/${paymentId}.json` });
  if (blobs.length) await del(blobs[0].url).catch(() => {});

  return res.status(200).json({ ok: true, subscription });
}
