// 구독 사용량 카운터 — 생성 작업 직전에 호출하여 quota 확인 + 1회 차감
// INTERNAL_USERS는 서버에서 9999 limit으로 응답 (실제 차감 없음)
// 비활성 구독이면 402, 한도 초과면 402, 정상이면 200

export async function incrementUsage(username) {
  if (!username) return { ok: true, usageCount: 0, limit: 0, remaining: 0 };
  const res = await fetch("/api/subscription/usage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || `사용량 확인 실패 (${res.status})`);
    err.status = res.status;
    err.usageCount = data?.usageCount;
    err.limit = data?.limit;
    throw err;
  }
  return data;
}
