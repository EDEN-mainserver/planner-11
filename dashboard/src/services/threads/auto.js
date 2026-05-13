// Threads 풀 자동화 API 호출 모듈
// 백엔드/DB 추후 작업 대비 — fetch 호출을 한 곳에 격리해서 엔드포인트·payload 변경 시 한 파일만 수정.

const ENDPOINTS = {
  config: "/api/threads-auto-config",
  research: "/api/threads-auto-research",
  monitor: "/api/threads-auto-monitor",
};

async function parseJsonSafe(res) {
  try { return await res.json(); } catch { return {}; }
}

// 현재 사용자 자동화 설정 조회
export async function fetchAutoConfig(username) {
  const res = await fetch(`${ENDPOINTS.config}?username=${encodeURIComponent(username)}`);
  if (!res.ok) return null;
  const data = await parseJsonSafe(res);
  return data?.config || null;
}

// 자동화 설정 저장 (서버 측 cron + 즉시 실행 양쪽에서 동일 payload 사용)
export async function saveAutoConfig(username, config) {
  const res = await fetch(ENDPOINTS.config, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, config }),
  });
  if (!res.ok) {
    const data = await parseJsonSafe(res);
    throw new Error(data?.error || "설정 저장 실패");
  }
  return parseJsonSafe(res);
}

// 자동화 1회 실행 (즉시 또는 배치 슬롯)
// options: { scheduledAt, allowExistingPendingAuto, scheduleMeta }
export async function runAutoResearch(username, runId, config, options = undefined) {
  const body = { username, runId, config };
  if (options) body.options = options;
  const res = await fetch(ENDPOINTS.research, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res;
}

// 모니터 스냅샷 조회 (현재 run + history)
export async function fetchAutoMonitor(username, runId = null) {
  const url = runId
    ? `${ENDPOINTS.monitor}?username=${encodeURIComponent(username)}&runId=${encodeURIComponent(runId)}`
    : `${ENDPOINTS.monitor}?username=${encodeURIComponent(username)}`;
  const res = await fetch(url);
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.error || "모니터 조회 실패");
  return data;
}

// 실행 중인 run 취소 (PATCH로 status를 canceling으로)
export async function cancelAutoRun(username, runId) {
  const res = await fetch(ENDPOINTS.monitor, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, runId }),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.error || "취소 실패");
  return data;
}

