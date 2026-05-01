import { head, put } from "@vercel/blob";

const PREFIX = "social-config";

function pathFor(username) {
  return `${PREFIX}/${username}.json`;
}

export async function readSocialConfig(username) {
  if (!username) return null;
  const info = await head(pathFor(username)).catch(() => null);
  if (!info?.url) return null;
  const res = await fetch(info.url, { cache: "no-store" });
  if (!res.ok) return null;
  return await res.json();
}

export async function writeSocialConfig(username, data) {
  if (!username) throw new Error("username 필요");
  await put(pathFor(username), JSON.stringify(data, null, 2), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}
