// 커뮤니티 영상 자동화 — 유틸리티 함수

// 텍스트에서 자막 타이밍 자동 생성 (TTS 없이 데모용)
export function generateCaptionsFromText(text) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const MS_PER_CHAR = 80; // 글자당 약 80ms
  const captions = [];
  let currentMs = 500; // 0.5초 인트로

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const duration = Math.max(300, word.length * MS_PER_CHAR);
    captions.push({
      text: i === 0 ? word : ` ${word}`,
      startMs: currentMs,
      endMs: currentMs + duration,
      timestampMs: currentMs,
      confidence: 1,
    });
    currentMs += duration + 50;
  }
  return { captions, totalMs: currentMs + 500 };
}

// 단어 수 기반 예상 영상 길이 계산 (초)
export function estimateSeconds(text) {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.round(wordCount * 0.4);
}
