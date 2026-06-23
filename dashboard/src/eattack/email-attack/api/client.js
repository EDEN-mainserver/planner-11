// E-MAIL Attack 전용 API 호출 래퍼
// - 다른 eattack 모듈의 api와 섞이지 않게 이 폴더 안에서만 사용

// 평탄화된 endpoint: /api/ea-* (Vercel functions config 호환)
async function call(path, opts = {}) {
  const res = await fetch(`/api/${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

export const emailAttackApi = {
  // 작업 시작 — 키워드 1개로 풀 파이프라인 실행
  run: ({ keyword, sources = ["google", "naver"], targetCount = 20 }) =>
    call("ea-run", {
      method: "POST",
      body: JSON.stringify({ keyword, sources, target_count: targetCount }),
    }),

  // 작업 상태 + 결과 폴링
  status: (jobId) => call(`ea-status?job_id=${encodeURIComponent(jobId)}`),

  // 작업 히스토리
  listJobs: () => call("ea-jobs"),

  // 작업 삭제 (결과도 같이)
  deleteJob: (id) => call(`ea-jobs?id=${encodeURIComponent(id)}`, { method: "DELETE" }),

  // 설정
  getSettings: () => call("ea-settings"),
  setSetting: (key, value) =>
    call("ea-settings", {
      method: "PATCH",
      body: JSON.stringify({ key, value }),
    }),
};
