export async function fetchSchedules(username) {
  const res = await fetch(`/api/schedule?username=${encodeURIComponent(username)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.schedules || [];
}

export async function addSchedule(username, schedule) {
  const res = await fetch("/api/schedule", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, schedule }),
  });
  const data = await res.json().catch(() => ({}));
  return {
    ok: res.ok,
    error: data?.error || "",
    schedule: data?.schedule || null,
    duplicate: data?.duplicate || null,
  };
}

export async function removeSchedule(username, id) {
  const res = await fetch("/api/schedule", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, id }),
  });
  return res.ok;
}

export async function clearDoneSchedulesServer(username) {
  const res = await fetch("/api/schedule", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  return res.ok;
}

export async function updateSchedule(username, id, updates) {
  const res = await fetch("/api/schedule", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, id, updates }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.schedule || null;
}

export async function fetchAutoRunDetail(username, runId) {
  const res = await fetch(`/api/threads-auto-monitor?username=${encodeURIComponent(username)}&runId=${encodeURIComponent(runId)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "실행 로그 조회 실패");
  return data.current || null;
}
