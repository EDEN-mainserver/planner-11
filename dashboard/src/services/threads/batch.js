export function getBatchStartDateKst(postTime) {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 3600 * 1000);
  const kstToday = kstNow.toISOString().slice(0, 10);
  const todayFirstSlot = new Date(`${kstToday}T${postTime}:00+09:00`);
  if (todayFirstSlot.getTime() > now.getTime()) return kstToday;

  const tomorrow = new Date(todayFirstSlot.getTime() + 24 * 60 * 60 * 1000);
  return new Date(tomorrow.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export function calcBatchScheduledAt(baseDateKst, postTime, dayOffset, slotIndex, intervalHours) {
  const [hh, mm] = postTime.split(":").map(Number);
  const base = new Date(`${baseDateKst}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+09:00`);
  base.setTime(base.getTime() + dayOffset * 24 * 60 * 60 * 1000 + slotIndex * intervalHours * 60 * 60 * 1000);
  return base.toISOString();
}
