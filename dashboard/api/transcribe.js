/**
 * 영상/오디오 전사 API — Vercel Serverless Function
 * POST /api/transcribe
 * Content-Type: audio/mpeg | audio/wav | video/mp4 등
 * Body: raw 오디오/영상 바이너리
 *
 * 프론트에서 @ffmpeg/ffmpeg(WASM)로 오디오 추출 후 전송
 * Whisper API로 전사 → 텍스트 + 세그먼트 타임스탬프 반환
 */

export const config = {
  api: { bodyParser: false },
  maxDuration: 120,
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return res.status(500).json({ error: "OPENAI_API_KEY 환경변수가 없습니다." });
  }

  // ── raw body 수집 ──────────────────────────────────────────────
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const audioBuffer = Buffer.concat(chunks);

  if (audioBuffer.length === 0) {
    return res.status(400).json({ error: "파일이 비어 있습니다." });
  }

  // 25MB 초과 시 거절 (Whisper 제한)
  if (audioBuffer.length > 25 * 1024 * 1024) {
    return res.status(413).json({ error: "파일이 25MB를 초과합니다. 더 짧은 영상을 사용하거나 오디오로 추출 후 업로드해주세요." });
  }

  // Content-Type → 확장자 결정
  const contentType = req.headers["content-type"] || "audio/mpeg";
  let ext = "mp3";
  if (contentType.includes("wav"))  ext = "wav";
  else if (contentType.includes("mp4")) ext = "mp4";
  else if (contentType.includes("m4a")) ext = "m4a";
  else if (contentType.includes("webm")) ext = "webm";

  console.log(`[transcribe] 파일 크기: ${(audioBuffer.length / 1024 / 1024).toFixed(2)}MB, 형식: ${ext}`);

  // ── Whisper API 호출 ───────────────────────────────────────────
  const formData = new FormData();
  formData.append("file", new Blob([audioBuffer], { type: contentType }), `audio.${ext}`);
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "segment");
  formData.append("language", "ko");

  const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${openaiKey}` },
    body: formData,
  });

  if (!whisperRes.ok) {
    const err = await whisperRes.json().catch(() => ({}));
    console.error("[transcribe] Whisper 오류:", err);
    return res.status(whisperRes.status).json({
      error: err?.error?.message || `Whisper API 오류 (${whisperRes.status})`,
    });
  }

  const data = await whisperRes.json();

  // ── 세그먼트 정제 + 의미 단위 그룹핑 ─────────────────────────
  const rawSegments = (data.segments || []).map(s => ({
    start: Math.round(s.start * 10) / 10,
    end:   Math.round(s.end   * 10) / 10,
    text:  s.text.trim(),
  }));

  // 짧은 세그먼트 병합 (2초 미만은 앞 세그먼트에 합침)
  const segments = [];
  for (const seg of rawSegments) {
    const duration = seg.end - seg.start;
    const last = segments[segments.length - 1];
    if (last && duration < 2 && last.end === seg.start) {
      last.end  = seg.end;
      last.text += " " + seg.text;
    } else {
      segments.push({ ...seg });
    }
  }

  console.log(`[transcribe] 완료 — 세그먼트 ${segments.length}개, 전체: ${data.duration?.toFixed(1)}초`);

  return res.status(200).json({
    text:     data.text,
    segments,
    duration: data.duration ?? null,
    count:    segments.length,
  });
}
