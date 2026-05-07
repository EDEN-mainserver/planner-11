import { readSocialConfig, writeSocialConfig } from "./_social-config.js";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    const username = String(req.query?.username || "").trim();
    if (!username) return res.status(400).json({ error: "username 필요" });
    const config = await readSocialConfig(username);
    return res.status(200).json({ ok: true, username, config: config || {} });
  }

  if (req.method === "POST") {
    const { username, instagram, threads } = req.body || {};
    const normalizedUsername = String(username || "").trim();
    if (!normalizedUsername) return res.status(400).json({ error: "username 필요" });

    const current = (await readSocialConfig(normalizedUsername)) || {};
    const next = {
      ...current,
      ...(instagram ? { instagram } : {}),
      ...(threads ? { threads } : {}),
      updatedAt: new Date().toISOString(),
    };
    await writeSocialConfig(normalizedUsername, next);
    return res.status(200).json({ ok: true, username: normalizedUsername, config: next });
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}
