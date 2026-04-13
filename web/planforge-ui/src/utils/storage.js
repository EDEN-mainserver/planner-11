const STORAGE_KEY       = 'planforge_projects';
const TRASH_STORAGE_KEY = 'planforge_trash';

export function loadProjects() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

export function saveProjects(projects) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function loadTrash() {
  try { return JSON.parse(localStorage.getItem(TRASH_STORAGE_KEY) || '[]'); } catch { return []; }
}

export function saveTrash(items) {
  localStorage.setItem(TRASH_STORAGE_KEY, JSON.stringify(items));
}

export function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전 수정`;
  const h = Math.floor(m / 60);
  if (h < 24) return `약 ${h}시간 전 수정`;
  return `${Math.floor(h / 24)}일 전 수정`;
}
