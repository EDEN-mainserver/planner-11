/**
 * UGREEN NAS 파일 저장 클라이언트
 *
 * 전략:
 *  1순위 — File System Access API (showDirectoryPicker)
 *           NAS를 Windows 네트워크 드라이브로 마운트한 뒤 폴더 선택 → CORS 없음
 *  2순위 — WebDAV 직접 (같은 네트워크에서 CORS 허용 시)
 *  3순위 — 브라우저 다운로드 fallback
 */

const STORAGE_KEY = 'eattack_nas_config';

// ── 설정 관리 ─────────────────────────────────────────────────────

export function getNasConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveNasConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearNasConfig() {
  localStorage.removeItem(STORAGE_KEY);
}

// ── File System Access API (1순위) ────────────────────────────────

/** 브라우저가 File System Access API를 지원하는지 확인 */
export function isFsApiSupported() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/**
 * 사용자에게 폴더 선택 다이얼로그를 열고 핸들을 반환
 * 선택한 핸들은 IndexedDB에 저장할 수 없으므로 세션 내 메모리에 보관
 */
let _dirHandle = null;

export async function pickNasFolder() {
  if (!isFsApiSupported()) throw new Error('이 브라우저는 폴더 직접 접근을 지원하지 않습니다 (Chrome 86+ 필요)');
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
  _dirHandle = handle;
  return handle.name;
}

export function getDirHandle() {
  return _dirHandle;
}

export function clearDirHandle() {
  _dirHandle = null;
}

/**
 * File System Access API로 파일 저장
 * subfolder가 있으면 하위 폴더를 자동 생성
 */
export async function saveFileViaFsApi(fileName, data, subfolder = '') {
  if (!_dirHandle) throw new Error('폴더가 선택되지 않았습니다. 먼저 NAS 폴더를 선택하세요.');

  let targetDir = _dirHandle;
  if (subfolder) {
    targetDir = await _dirHandle.getDirectoryHandle(subfolder, { create: true });
  }

  const fileHandle = await targetDir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();

  // data가 Blob/File이면 그대로, string이면 인코딩
  if (typeof data === 'string') {
    await writable.write(new TextEncoder().encode(data));
  } else {
    await writable.write(data);
  }
  await writable.close();

  return subfolder ? `[선택폴더]/${subfolder}/${fileName}` : `[선택폴더]/${fileName}`;
}

/**
 * File System Access API로 폴더 내 파일 목록 조회
 */
export async function listFsFolder(subfolder = '') {
  if (!_dirHandle) return [];

  let dir = _dirHandle;
  if (subfolder) {
    try {
      dir = await _dirHandle.getDirectoryHandle(subfolder, { create: false });
    } catch {
      return [];
    }
  }

  const items = [];
  for await (const [name, handle] of dir.entries()) {
    items.push({
      name,
      isDir: handle.kind === 'directory',
      handle,
    });
  }
  return items.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name, 'ko');
  });
}

// ── Docker 프록시 / dufs (2순위, 가장 안정적인 네트워크 방식) ────────

/**
 * dufs 컨테이너 연결 테스트
 * dufs는 GET / 로 디렉토리 목록을 반환함 (WebDAV PROPFIND도 지원)
 */
export async function testDufsConnection(host, port) {
  const url = `http://${host}:${port}/`;
  try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5000) });
    if (res.ok) return { ok: true, message: '프록시 서버 연결 성공' };
    return { ok: false, message: `HTTP ${res.status}` };
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      return { ok: false, cors: true, message: '컨테이너에 접근할 수 없습니다. 포트와 IP를 확인하세요.' };
    }
    return { ok: false, message: `연결 오류: ${msg}` };
  }
}

/**
 * dufs에 파일 업로드 (PUT)
 * dufs는 인증 없이도 동작 (--allow-all 플래그 사용 시)
 */
export async function uploadToDufs(host, port, remotePath, data, mimeType = 'application/octet-stream') {
  const url = `http://${host}:${port}/${remotePath.replace(/^\//, '')}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: data,
  });
  if (!res.ok && res.status !== 201 && res.status !== 204) {
    throw new Error(`업로드 실패: HTTP ${res.status}`);
  }
  return `http://${host}:${port}/${remotePath.replace(/^\//, '')}`;
}

/**
 * dufs 폴더 생성 (MKCOL — WebDAV)
 */
export async function createDufsFolder(host, port, folderPath) {
  const url = `http://${host}:${port}/${folderPath.replace(/^\//, '')}/`;
  const res = await fetch(url, { method: 'MKCOL' });
  if (res.status !== 201 && res.status !== 405 && res.status !== 200) {
    // dufs는 자동으로 상위 폴더도 생성하므로 대부분 성공
    console.warn(`MKCOL ${folderPath}: ${res.status}`);
  }
}

/**
 * dufs 파일 목록 조회 (JSON 모드)
 */
export async function listDufsFolder(host, port, folderPath = '') {
  const path = folderPath.replace(/^\//, '');
  const url = `http://${host}:${port}/${path}${path ? '/' : ''}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`목록 조회 실패: HTTP ${res.status}`);

  // dufs JSON 응답 파싱
  try {
    const data = await res.json();
    // dufs 응답: { paths: [{ name, path, is_dir, size, ... }] }
    const paths = data.paths || [];
    return paths
      .filter(p => p.name !== '.') // 현재 디렉토리 항목 제외
      .map(p => ({
        name: p.name,
        isDir: p.is_dir,
        size: p.size || 0,
        href: `http://${host}:${port}/${p.path}`,
      }))
      .sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name, 'ko');
      });
  } catch {
    return [];
  }
}

/**
 * dufs에 파일 저장 (편의 함수)
 */
export async function saveFileToDufs(host, port, fileName, data, mimeType, subfolder = '') {
  if (subfolder) {
    await createDufsFolder(host, port, subfolder);
  }
  const remotePath = subfolder ? `${subfolder}/${fileName}` : fileName;
  return uploadToDufs(host, port, remotePath, data, mimeType);
}

// ── WebDAV (3순위, CORS 허용 환경에서만 동작) ────────────────────

function buildAuth(username, password) {
  return 'Basic ' + btoa(unescape(encodeURIComponent(`${username}:${password}`)));
}

export function buildBaseUrl(config) {
  const scheme = config.useHttps ? 'https' : 'http';
  const davPath = (config.davPath || '/dav').replace(/\/+$/, '');
  return `${scheme}://${config.host}:${config.port}${davPath}`;
}

function buildUrl(config, path = '') {
  const base = buildBaseUrl(config);
  const clean = path.startsWith('/') ? path : '/' + path;
  return base + clean;
}

async function davFetch(url, method, config, body = null, extraHeaders = {}) {
  const headers = {
    Authorization: buildAuth(config.username, config.password),
    ...extraHeaders,
  };
  if (body) headers['Content-Type'] = 'application/xml; charset=utf-8';
  return fetch(url, { method, headers, body });
}

/**
 * WebDAV 연결 테스트
 * @returns {{ ok: boolean, message: string, cors?: boolean }}
 */
export async function testNasConnection(config) {
  const url = buildUrl(config, '/');
  const propfindBody = `<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>`;

  try {
    const res = await davFetch(url, 'PROPFIND', config, propfindBody, { Depth: '0' });
    if (res.status === 207 || res.status === 200) return { ok: true, message: '연결 성공' };
    if (res.status === 401) return { ok: false, message: '인증 실패: 아이디 또는 비밀번호를 확인하세요' };
    if (res.status === 404) return { ok: false, message: 'WebDAV 경로를 찾을 수 없습니다 (/dav 확인)' };
    return { ok: false, message: `HTTP ${res.status} 오류` };
  } catch (err) {
    const msg = err.message || '';
    // "Failed to fetch" = CORS 또는 네트워크 불가 모두 해당
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      return { ok: false, cors: true, message: 'CORS_OR_OFFLINE' };
    }
    return { ok: false, message: `오류: ${msg}` };
  }
}

export async function uploadToNas(config, remotePath, data, mimeType = 'application/octet-stream') {
  const url = buildUrl(config, remotePath);
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: buildAuth(config.username, config.password),
      'Content-Type': mimeType,
    },
    body: data,
  });
  if (res.status !== 201 && res.status !== 204 && res.status !== 200) {
    throw new Error(`업로드 실패: HTTP ${res.status}`);
  }
  return true;
}

export async function createNasFolder(config, folderPath) {
  const url = buildUrl(config, folderPath);
  const res = await davFetch(url, 'MKCOL', config);
  if (res.status !== 201 && res.status !== 405) {
    throw new Error(`폴더 생성 실패: HTTP ${res.status}`);
  }
}

export async function listNasFolder(config, folderPath = '') {
  const url = buildUrl(config, folderPath || config.baseFolder || '/');
  const body = `<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:displayname/><d:resourcetype/><d:getcontentlength/><d:getlastmodified/></d:prop></d:propfind>`;
  const res = await davFetch(url, 'PROPFIND', config, body, { Depth: '1' });
  if (res.status !== 207 && res.status !== 200) throw new Error(`목록 조회 실패: HTTP ${res.status}`);
  return parseWebDavListing(await res.text());
}

function parseWebDavListing(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const responses = Array.from(doc.querySelectorAll('response'));
  const items = [];
  responses.slice(1).forEach(resp => {
    const href = resp.querySelector('href')?.textContent?.trim() || '';
    const name = resp.querySelector('displayname')?.textContent?.trim()
      || decodeURIComponent(href.split('/').filter(Boolean).pop() || '');
    const isDir = !!resp.querySelector('collection');
    const size = parseInt(resp.querySelector('getcontentlength')?.textContent || '0', 10);
    items.push({ href, name, isDir, size });
  });
  return items.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name, 'ko');
  });
}

export async function saveFileToNas(config, fileName, data, mimeType, subfolder = '') {
  const base = (config.baseFolder || 'E-Attack').replace(/\/+$/, '');
  await createNasFolder(config, base);
  let targetFolder = base;
  if (subfolder) {
    targetFolder = `${base}/${subfolder}`;
    await createNasFolder(config, targetFolder);
  }
  const remotePath = `${targetFolder}/${fileName}`;
  await uploadToNas(config, remotePath, data, mimeType);
  return remotePath;
}

// ── 유틸 ─────────────────────────────────────────────────────────

export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** 브라우저 다운로드 fallback */
export function downloadFile(fileName, data, mimeType = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
