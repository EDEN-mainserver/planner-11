import { put, list } from "@vercel/blob";
import crypto from "crypto";

const PLANS = { basic: { price: 9900 }, standard: { price: 29900 }, premium: { price: 79900 } };

async function saveSubscription(userId, planId, status) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const resetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const { blobs } = await list({ prefix: `subscriptions/${userId}.json` });
  let existing = null;
  if (blobs.length) {
    const r = await fetch(blobs[0].url);
    if (r.ok) existing = await r.json();
  }
  const data = {
    userId,
    planId,
    status,
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: end.toISOString(),
    usageCount: existing?.usageCount || 0,
    usageResetAt: existing?.usageResetAt || resetAt.toISOString(),
    updatedAt: now.toISOString(),
  };
  await put(`subscriptions/${userId}.json`, JSON.stringify(data, null, 2), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
  });
}

async function getPending(paymentId) {
  const { blobs } = await list({ prefix: `payment-pending/${paymentId}.json` });
  if (!blobs.length) return null;
  const r = await fetch(blobs[0].url);
  return r.ok ? await r.json() : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const webhookSecret = process.env.PORTONE_WEBHOOK_SECRET;
  if (webhookSecret) {
    const sig = req.headers["webhook-signature"] || "";
    const body = JSON.stringify(req.body);
    const expected = crypto.createHmac("sha256", webhookSecret).update(body).digest("hex");
    if (sig !== expected) return res.status(401).json({ error: "서명 불일치" });
  }

  const { type, data } = req.body || {};
  if (!type || !data) return res.status(400).end();

  if (type === "Transaction.Paid") {
    const { paymentId, amount } = data;
    const pending = await getPending(paymentId);
    if (pending && PLANS[pending.planId]?.price === amount?.total) {
      await saveSubscription(pending.userId, pending.planId, "active");
    }
  } else if (type === "Transaction.Cancelled") {
    const { paymentId } = data;
    const pending = await getPending(paymentId);
    if (pending) await saveSubscription(pending.userId, pending.planId, "expired");
  }

  return res.status(200).json({ ok: true });
}
