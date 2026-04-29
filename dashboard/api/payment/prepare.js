import { put } from "@vercel/blob";

const PLANS = {
  basic:    { name: "베이직 플랜", price: 9900 },
  standard: { name: "스탠다드 플랜", price: 29900 },
  premium:  { name: "프리미엄 플랜", price: 79900 },
};

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { userId, planId } = req.body || {};
  if (!userId || !planId) return res.status(400).json({ error: "userId, planId 필요" });

  const plan = PLANS[planId];
  if (!plan) return res.status(400).json({ error: "유효하지 않은 플랜" });

  const paymentId = `PAY-${userId}-${planId}-${Date.now()}`;

  await put(
    `payment-pending/${paymentId}.json`,
    JSON.stringify({ paymentId, userId, planId, amount: plan.price, createdAt: new Date().toISOString() }, null, 2),
    { access: "public", contentType: "application/json", allowOverwrite: true }
  );

  return res.status(200).json({
    paymentId,
    planName: plan.name,
    amount: plan.price,
  });
}
