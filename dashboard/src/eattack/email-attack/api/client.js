// E-MAIL Attack 전용 API 호출 래퍼
// - 다른 eattack 모듈의 api와 섞이지 않게 이 폴더 안에서만 사용

// 통합 endpoint: /api/ea?fn=...  (Vercel 함수 1개로 묶음)
async function call(qs, opts = {}) {
  const res = await fetch(`/api/ea?${qs}`, {
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
  // 작업 시작
  run: ({ keyword, sources = ["google", "naver"], targetCount = 20 }) =>
    call("fn=run", {
      method: "POST",
      body: JSON.stringify({ keyword, sources, target_count: targetCount }),
    }),

  // 작업 상태 + 결과 폴링
  status: (jobId) => call(`fn=status&job_id=${encodeURIComponent(jobId)}`),

  // 작업 히스토리
  listJobs: () => call("fn=jobs"),

  // 작업 삭제
  deleteJob: (id) => call(`fn=jobs&id=${encodeURIComponent(id)}`, { method: "DELETE" }),

  // 설정
  getSettings: () => call("fn=settings"),
  setSetting: (key, value) =>
    call("fn=settings", {
      method: "PATCH",
      body: JSON.stringify({ key, value }),
    }),
};
