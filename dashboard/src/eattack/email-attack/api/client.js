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

  // 제안서 일괄 생성 (Claude)
  generateProposals: ({ jobId, sender, onlyMissing = true, concurrency = 4 }) =>
    call("fn=generate", {
      method: "POST",
      body: JSON.stringify({
        job_id: jobId,
        sender,
        only_missing: onlyMissing,
        concurrency,
      }),
    }),

  // 제안서 목록 조회
  listProposals: (jobId) => call(`fn=proposals&job_id=${encodeURIComponent(jobId)}`),

  // 제안서 수정 저장
  updateProposal: ({ id, subject, body_html, body_text, approved }) =>
    call("fn=update_proposal", {
      method: "PATCH",
      body: JSON.stringify({ id, subject, body_html, body_text, approved }),
    }),

  // 우리 테스트 메일로만 발송
  sendTestProposal: ({ id, toEmail }) =>
    call("fn=send_test_proposal", {
      method: "POST",
      body: JSON.stringify({ id, to_email: toEmail }),
    }),
};
