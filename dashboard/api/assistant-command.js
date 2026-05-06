import { head, put } from "@vercel/blob";

export const config = { api: { bodyParser: { sizeLimit: "3mb" } } };

const FULL_AUTO_CONFIG_PATH = "full-auto/team-config.json";

function checkAuth(req) {
  const secret = process.env.FULL_AUTO_SECRET;
  if (!secret) return true;
  return req.headers.authorization === `Bearer ${secret}`;
}

async function readBlob(path) {
  try {
    const info = await head(path).catch(() => null);
    if (!info) return null;
    const res = await fetch(info.url, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function writeBlob(path, data) {
  await put(path, JSON.stringify(data, null, 2), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
  });
}

function normalizeAccount(account) {
  if (!account || !account.id) return null;
  const settings = account.settings || {};
  return {
    id: String(account.id),
    name: account.name || account.displayName || account.id,
    enabled: account.enabled !== false,
    igAccountId: account.igAccountId || "",
    igAccessToken: account.igAccessToken || "",
    threadsUserId: account.threadsUserId || "",
    threadsAccessToken: account.threadsAccessToken || "",
    settings: {
      topics: settings.topics || "",
      brandName: settings.brandName || "",
      tone: settings.tone || "friendly and professional",
      slideCount: Math.min(Math.max(Number(settings.slideCount) || 5, 1), 10),
      captionTemplate: settings.captionTemplate || "{title}\n\n{body}",
    },
  };
}

function validateFullAutoAccount(account) {
  const problems = [];
  if (!account.settings?.topics) problems.push("topics");
  if (!account.igAccountId && !account.threadsUserId) problems.push("socialAccount");
  return problems;
}

async function configureFullAutoHourly(req, res) {
  const { accounts = [], requestedBy = "assistant", sourceText = "" } = req.body || {};
  const normalized = accounts.map(normalizeAccount).filter(Boolean);
  const runnable = normalized.filter((account) => validateFullAutoAccount(account).length === 0);

  if (!runnable.length) {
    return res.status(400).json({
      error: "No runnable full-auto account found.",
      detail: "At least one account needs topics and Instagram or Threads credentials.",
    });
  }

  const current = (await readBlob(FULL_AUTO_CONFIG_PATH)) || { accounts: [] };
  const accountMap = new Map((current.accounts || []).map((account) => [account.id, account]));
  for (const account of runnable) {
    accountMap.set(account.id, {
      ...accountMap.get(account.id),
      ...account,
      enabled: true,
      assistantManaged: true,
      assistantUpdatedAt: new Date().toISOString(),
    });
  }

  const nextConfig = {
    ...current,
    accounts: Array.from(accountMap.values()),
    assistantAutomation: {
      mode: "full_auto_hourly",
      enabled: true,
      requestedBy,
      sourceText,
      updatedAt: new Date().toISOString(),
      note: "The existing full-auto cron runs enabled accounts on its configured schedule.",
    },
  };

  await writeBlob(FULL_AUTO_CONFIG_PATH, nextConfig);

  return res.status(200).json({
    ok: true,
    action: "full_auto_hourly_configured",
    accountCount: runnable.length,
    accounts: runnable.map((account) => ({ id: account.id, name: account.name })),
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
  if (!checkAuth(req)) return res.status(401).json({ error: "Unauthorized" });

  const { action } = req.body || {};
  if (action === "configure_full_auto_hourly") return configureFullAutoHourly(req, res);

  return res.status(400).json({ error: `Unsupported assistant action: ${action || "empty"}` });
}
