/**
 * UGREEN NAS WebDAV 클라이언트
 * - WebDAV 프로토콜로 NAS에 파일 업로드/목록 조회
 * - 설정은 localStorage에 저장 (비밀번호 포함 — 내부 도구 전용)
 */

const STORAGE_KEY = 'eattack_nas_config';

// ── 설정 관리 ──────────────────────────────────────────────────

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

// ── URL / 인증 헬퍼 ────────────────────────────────────────────

function buildAuth(username, password) {
  // btoa는 ASCII만 처리하므로 URI 인코딩 후 변환
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

// ── WebDAV 요청 공통 래퍼 ──────────────────────────────────────

async function davFetch(url, method, config, body = null, extraHeaders = {}) {
  const headers = {
    Authorization: buildAuth(config.username, config.password),
    ...extraHeaders,
  };
  if (body) headers['Content-Type'] = 'application/xml; charset=utf-8';

  const res = await fetch(url, { method, headers, body });
  return res;
}

// ── 연결 테스트 ────────────────────────────────────────────────

/**
 * NAS WebDAV 연결 테스트
 * @returns {Promise<{ok: boolean, message: string}>}
 */
export async function testNasConnection(config) {
  const url = buildUrl(config, config.baseFolder || '/');
  const propfindBody = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop><d:resourcetype/></d:prop>
</d:propfind>`;

  try {
    const res = await davFetch(url, 'PROPFIND', config, propfindBody, { Depth: '0' });

    if (res.status === 207 || res.status === 200) {
      return { ok: true, message: '연결 성공' };
    }
    if (res.status === 401) {
      return { ok: false, message: '인증 실패: 아이디 또는 비밀번호를 확인하세요' };
    }
    if (res.status === 404) {
      return { ok: false, message: `폴더를 찾을 수 없습니다: ${config.baseFolder || '/'}` };
    }
    return { ok: false, message: `HTTP ${res.status} 오류` };

  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('CORS')) {
      return {
        ok: false,
        message: 'CORS_ERROR',
      };
    }
    return { ok: false, message: `네트워크 오류: ${msg}` };
  }
}

// ── 폴더 목록 ──────────────────────────────────────────────────

/**
 * 폴더 내 파일/폴더 목록 조회
 * @returns {Promise<Array<{name, href, isDir, size, modified}>>}
 */
export async function listNasFolder(config, folderPath = '') {
  const url = buildUrl(config, folderPath || config.baseFolder || '/');
  const propfindBody = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:displayname/>
    <d:resourcetype/>
    <d:getcontentlength/>
    <d:getlastmodified/>
    <d:getcontenttype/>
  </d:prop>
</d:propfind>`;

  const res = await davFetch(url, 'PROPFIND', config, propfindBody, { Depth: '1' });

  if (res.status !== 207 && res.status !== 200) {
    throw new Error(`목록 조회 실패: HTTP ${res.status}`);
  }

  const text = await res.text();
  return parseWebDavListing(text);
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
    const modified = resp.querySelector('getlastmodified')?.textContent?.trim() || '';
    const contentType = resp.querySelector('getcontenttype')?.textContent?.trim() || '';
    items.push({ href, name, isDir, size, modified, contentType });
  });

  // 폴더 먼저, 그다음 파일 (이름 정렬)
  return items.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name, 'ko');
  });
}

// ── 폴더 생성 ──────────────────────────────────────────────────

export async function createNasFolder(config, folderPath) {
  const url = buildUrl(config, folderPath);
  const res = await davFetch(url, 'MKCOL', config);
  // 405 = 이미 존재 (정상)
  if (res.status !== 201 && res.status !== 405) {
    throw new Error(`폴더 생성 실패: HTTP ${res.status}`);
  }
}

// ── 파일 업로드 ────────────────────────────────────────────────

/**
 * 파일(Blob/ArrayBuffer/string)을 NAS에 업로드
 * @param {NasConfig} config
 * @param {string} remotePath - NAS 상의 파일 경로 (baseFolder 포함)
 * @param {Blob|ArrayBuffer|string} data
 * @param {string} mimeType
 */
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

// ── 편의 함수 ──────────────────────────────────────────────────

/**
 * 파일을 baseFolder 하위에 저장
 * subfolder를 지정하면 baseFolder/subfolder/ 에 저장
 */
export async function saveFileToNas(config, fileName, data, mimeType, subfolder = '') {
  const base = (config.baseFolder || 'E-Attack').replace(/\/+$/, '');
  // baseFolder 생성 (없으면)
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

// ── 파일 크기 포맷 ─────────────────────────────────────────────

export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
