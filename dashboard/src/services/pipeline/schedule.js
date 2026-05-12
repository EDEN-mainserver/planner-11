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
  return { ok: res.ok, error: data?.error || "", schedule: data?.schedule || null };
}

export async function removeSchedule(username, id) {
  const res = await fetch("/api/schedule", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, id }),
  });
  return res.ok;
}
