import { NARROW_KEYWORD_MARKERS, TH_MAX_CHARS } from "../../eattack/threads/constants";

export function looksNarrowKeywordSet(keywords) {
  const cleaned = (Array.isArray(keywords) ? keywords : [])
    .map((keyword) => String(keyword || "").toLowerCase().replace(/\s+/g, ""))
    .filter(Boolean);
  if (cleaned.length < 3) return false;
  return cleaned.every((keyword) => NARROW_KEYWORD_MARKERS.some((marker) => keyword.includes(marker)));
}

export function toDatetimeLocalValue(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function fromDatetimeLocalValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export async function parseResponsePayload(res) {
  const raw = await res.text();
  try {
    return { data: JSON.parse(raw), raw };
  } catch {
    return { data: null, raw };
  }
}

export function cleanThreadDraft(raw) {
  if (!raw) return "";
  let text = raw
    .replace(/\r/g, "")
    .replace(/```[\s\S]*?```/g, m => m.replace(/```[a-z]*\n?/gi, "").replace(/```/g, ""))
    .trim();

  const lines = text.split("\n");
  const cleaned = [];
  let started = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (started && cleaned[cleaned.length - 1] !== "") cleaned.push("");
      continue;
    }
    if (/^(네|좋아요|물론|알겠습니다)[,!\s]/.test(trimmed)) continue;
    if (/^[-–—]{3,}$/.test(trimmed)) continue;
    if (/^#{1,6}\s*/.test(trimmed)) continue;
    if (/^[ABC]\s*안\s*(\(|:|：)/i.test(trimmed)) {
      if (started) break;
      continue;
    }
    if (/^\d+\s*[).]\s*(안|버전)/.test(trimmed)) {
      if (started) break;
      continue;
    }
    if (/^(선택|원하시면|마음에 드는|아래는|다음은)/.test(trimmed)) continue;
    started = true;
    cleaned.push(line.replace(/^[-*]\s+/, "").trimEnd());
  }

  return cleaned
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, TH_MAX_CHARS);
}
