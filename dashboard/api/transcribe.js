/**
 * 영상/오디오 전사 API — Vercel Serverless Function
 * POST /api/transcribe  Body: { url: string }  (Vercel Blob URL)
 *
 * 흐름:
 * 1. 클라이언트가 /api/blob-upload 에서 토큰 발급 후 Vercel Blob에 직접 업로드
 * 2. 업로드된 Blob URL을 이 엔드포인트로 전달
 * 3. Blob URL → 파일 다운로드 → Whisper API 전사 → Blob 삭제 → 결과 반환
 */
import { del } from "@vercel/blob";

export const config = { maxDuration: 120 };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return res.status(500).json({ error: "OPENAI_API_KEY 환경변수가 없습니다." });
  }

  const { url } = req.body ?? {};
  if (!url) {
    return res.status(400).json({ error: "url 필드가 필요합니다." });
  }

  // ── Blob URL에서 파일 다운로드 ──────────────────────────────────
  let fileBuffer;
  let contentType = "video/mp4";
  try {
    const fileRes = await fetch(url);
    if (!fileRes.ok) throw new Error(`Blob 다운로드 실패 (${fileRes.status})`);
    contentType = fileRes.headers.get("content-type") || "video/mp4";
    const arrayBuffer = await fileRes.arrayBuffer();
    fileBuffer = Buffer.from(arrayBuffer);
    console.log(`[transcribe] 다운로드 완료: ${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB, 형식: ${contentType}`);
  } catch (e) {
    return res.status(500).json({ error: `파일 다운로드 오류: ${e.message}` });
  }

  // 25MB 초과 시 거절 (Whisper 제한)
  if (fileBuffer.length > 25 * 1024 * 1024) {
    await del(url).catch(() => {});
    return res.status(413).json({
      error: `파일이 ${(fileBuffer.length / 1024 / 1024).toFixed(1)}MB입니다. Whisper 제한(25MB)을 초과합니다. 더 짧은 영상을 사용해주세요.`,
    });
  }

  // ── Whisper API 호출 ───────────────────────────────────────────
  let ext = "mp4";
  if (contentType.includes("wav"))  ext = "wav";
  else if (contentType.includes("mpeg") || contentType.includes("mp3")) ext = "mp3";
  else if (contentType.includes("m4a")) ext = "m4a";
  else if (contentType.includes("webm")) ext = "webm";
  else if (contentType.includes("quicktime") || contentType.includes("mov")) ext = "mov";

  const formData = new FormData();
  formData.append("file", new Blob([fileBuffer], { type: contentType }), `audio.${ext}`);
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "segment");
  formData.append("language", "ko");

  let data;
  try {
    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openaiKey}` },
      body: formData,
    });
    if (!whisperRes.ok) {
      const err = await whisperRes.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Whisper API 오류 (${whisperRes.status})`);
    }
    data = await whisperRes.json();
  } catch (e) {
    await del(url).catch(() => {});
    return res.status(500).json({ error: e.message });
  }

  // ── Blob 파일 삭제 (전사 완료 후) ─────────────────────────────
  await del(url).catch((e) => console.warn("[transcribe] Blob 삭제 실패:", e.message));

  // ── 세그먼트 정제 + 짧은 구간 병합 ───────────────────────────
  const rawSegments = (data.segments || []).map(s => ({
    start: Math.round(s.start * 10) / 10,
    end:   Math.round(s.end   * 10) / 10,
    text:  s.text.trim(),
  }));

  const segments = [];
  for (const seg of rawSegments) {
    const last = segments[segments.length - 1];
    if (last && (seg.end - seg.start) < 2 && last.end === seg.start) {
      last.end  = seg.end;
      last.text += " " + seg.text;
    } else {
      segments.push({ ...seg });
    }
  }

  console.log(`[transcribe] 완료 — 세그먼트 ${segments.length}개, ${data.duration?.toFixed(1)}초`);

  return res.status(200).json({
    text:     data.text,
    segments,
    duration: data.duration ?? null,
    count:    segments.length,
  });
}
