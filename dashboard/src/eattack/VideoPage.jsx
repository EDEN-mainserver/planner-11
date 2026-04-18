/**
 * 영상 콘텐츠 페이지
 * - NAS 연동 설정 탭 (UGREEN: FS API 폴더선택 / WebDAV)
 * - 영상편집 자동화 탭
 * - 풀그래픽영상 탭
 * - 커뮤니티 영상 탭
 * - 롱폼을 숏폼으로 탭
 */
import { useState, useCallback, useEffect } from "react";
import CommunityTab from "./community/index";
import {
  getNasConfig,
  saveNasConfig,
  clearNasConfig,
  testNasConnection,
  listNasFolder,
  saveFileToNas,
  isFsApiSupported,
  pickNasFolder,
  clearDirHandle,
  saveFileViaFsApi,
  listFsFolder,
  downloadFile,
  formatBytes,
  testDufsConnection,
  saveFileToDufs,
  listDufsFolder,
} from "../utils/nasClient";

// ── 탭 정의 ──────────────────────────────────────────────────────
const VIDEO_TABS = [
  {
    key: "nas",
    label: "NAS 연동 설정",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/>
        <line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>
      </svg>
    ),
    gradient: "from-slate-500 to-gray-600",
    description: "NAS 서버와 연동하여 영상 파일을 자동으로 저장·관리합니다",
  },
  {
    key: "autoedit",
    label: "영상편집 자동화",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>
      </svg>
    ),
    gradient: "from-purple-500 to-violet-600",
    description: "원본 영상을 입력하면 AI가 자동으로 편집·자막·컷 편집을 처리합니다",
  },
  {
    key: "fullgraphic",
    label: "풀그래픽영상",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
        <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
      </svg>
    ),
    gradient: "from-fuchsia-500 to-pink-600",
    description: "텍스트·이미지만으로 모션그래픽 기반 풀그래픽 영상을 자동 생성합니다",
  },
  {
    key: "community",
    label: "커뮤니티 영상",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    gradient: "from-indigo-500 to-blue-600",
    description: "커뮤니티 반응형 숏폼·릴스 영상을 주제에 맞게 자동으로 기획·제작합니다",
  },
  {
    key: "longshort",
    label: "롱폼을 숏폼으로",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/>
      </svg>
    ),
    gradient: "from-orange-500 to-rose-500",
    description: "긴 영상을 업로드하면 AI가 핵심 장면을 추출해 숏폼·릴스로 자동 변환합니다",
  },
];

// ── NAS 상태 뱃지 ─────────────────────────────────────────────────
function NasBadge({ nasState }) {
  if (!nasState) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        NAS 미연결
      </span>
    );
  }
  if (nasState.method === 'docker') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Docker {nasState.host}:{nasState.port} 연결됨
      </span>
    );
  }
  if (nasState.method === 'fs') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-50 text-teal-700">
        <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
        {nasState.folderName} 연결됨
      </span>
    );
  }
  if (nasState.method === 'webdav' && nasState.connected) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        WebDAV {nasState.host} 연결됨
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
      {nasState.host || '설정됨'} (미확인)
    </span>
  );
}

// ── NAS 저장 푸터 (각 탭 하단 공통) ─────────────────────────────────
function NasSaveFooter({ nasState, subfolder, onGoToNas }) {
  const [file, setFile]           = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult]       = useState(null);

  const isReady = !!(nasState);

  const handleUpload = useCallback(async () => {
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      let path;
      if (nasState?.method === 'docker') {
        // Docker 프록시 (dufs) — CORS 완전 해결, 가장 안정적
        path = await saveFileToDufs(
          nasState.host, nasState.port,
          file.name, file, file.type || 'application/octet-stream', subfolder
        );
      } else if (nasState?.method === 'fs') {
        // FS API — 마운트된 NAS 드라이브에 직접 저장
        path = await saveFileViaFsApi(file.name, file, subfolder);
      } else if (nasState?.method === 'webdav') {
        // WebDAV
        const cfg = getNasConfig();
        path = await saveFileToNas(cfg, file.name, file, file.type || 'application/octet-stream', subfolder);
      } else {
        // Fallback: 브라우저 다운로드
        downloadFile(file.name, file, file.type);
        path = '(브라우저 다운로드)';
      }
      setResult({ ok: true, path });
    } catch (err) {
      setResult({ ok: false, error: err.message });
    } finally {
      setUploading(false);
    }
  }, [file, nasState, subfolder]);

  return (
    <div className="border-t border-gray-100 bg-gray-50/60 px-6 py-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
            <rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/>
            <line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>
          </svg>
          <span className="text-xs font-semibold text-gray-600">NAS 저장</span>
        </div>
        <NasBadge nasState={nasState} />
      </div>

      {!isReady ? (
        <div className="flex items-center gap-2">
          <p className="text-xs text-gray-400">NAS 연결 설정 후 파일을 바로 저장할 수 있습니다.</p>
          <button
            onClick={onGoToNas}
            className="text-xs text-purple-600 font-medium underline underline-offset-2 hover:text-purple-800"
          >
            설정하러 가기
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {nasState?.method === 'docker' && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>저장 위치:</span>
              <code className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-700 font-mono">
                http://{nasState.host}:{nasState.port}/{subfolder}/
              </code>
            </div>
          )}
          {nasState?.method === 'fs' && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>저장 위치:</span>
              <code className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-700 font-mono">
                {nasState.folderName}/{subfolder}/
              </code>
            </div>
          )}
          {nasState?.method === 'webdav' && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>저장 위치:</span>
              <code className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-700 font-mono">
                {nasState.baseFolder || 'E-Attack'}/{subfolder}/
              </code>
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="flex-1 cursor-pointer">
              <input
                type="file"
                className="hidden"
                onChange={e => { setFile(e.target.files[0] || null); setResult(null); }}
              />
              <span className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 bg-white text-xs text-gray-500 hover:border-gray-400 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>
                </svg>
                {file ? file.name : '파일 선택'}
              </span>
            </label>
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="px-4 py-2 rounded-lg bg-slate-700 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              {uploading ? (
                <>
                  <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  저장 중…
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                  </svg>
                  NAS에 저장
                </>
              )}
            </button>
          </div>

          {result && (
            <p className={`text-xs ${result.ok ? 'text-emerald-600' : 'text-red-500'}`}>
              {result.ok ? `✓ 저장됨: ${result.path}` : `✕ ${result.error}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── NAS 연동 설정 탭 ──────────────────────────────────────────────
function NasTab({ nasState, onConnect, onDisconnect }) {
  // ── Docker 프록시 상태 ──
  const [dockerHost, setDockerHost] = useState(
    nasState?.method === 'docker' ? nasState.host : ''
  );
  const [dockerPort, setDockerPort] = useState(
    nasState?.method === 'docker' ? String(nasState.port) : '5055'
  );
  const [dockerTesting,    setDockerTesting]    = useState(false);
  const [dockerTestResult, setDockerTestResult] = useState(null);
  const [dockerItems,      setDockerItems]      = useState(null);
  const [dockerLoading,    setDockerLoading]    = useState(false);

  const handleDockerTest = async () => {
    setDockerTesting(true);
    setDockerTestResult(null);
    const res = await testDufsConnection(dockerHost, dockerPort);
    setDockerTesting(false);
    setDockerTestResult(res);
    if (res.ok) {
      onConnect({ method: 'docker', host: dockerHost, port: dockerPort });
    }
  };

  const handleDockerList = async () => {
    setDockerLoading(true);
    try {
      const items = await listDufsFolder(dockerHost, dockerPort, '');
      setDockerItems(items);
    } catch (err) {
      setDockerTestResult({ ok: false, message: err.message });
    } finally {
      setDockerLoading(false);
    }
  };

  // ── FS API 상태 ──
  const fsSupported = isFsApiSupported();
  const [picking, setPicking]       = useState(false);
  const [fsItems, setFsItems]       = useState(null);
  const [fsError, setFsError]       = useState('');
  const [fsLoading, setFsLoading]   = useState(false);

  // ── WebDAV 상태 ──
  const savedCfg = getNasConfig();
  const [davOpen, setDavOpen]       = useState(false);
  const [form, setForm]             = useState({
    host:       savedCfg?.host       || '',
    port:       savedCfg?.port       || '5006',
    username:   savedCfg?.username   || '',
    password:   savedCfg?.password   || '',
    davPath:    savedCfg?.davPath    || '/dav',
    baseFolder: savedCfg?.baseFolder || 'E-Attack',
    useHttps:   savedCfg?.useHttps   || false,
  });
  const [testing,    setTesting]    = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving,     setSaving]     = useState(false);

  // 가이드 접이식
  const [guideOpen, setGuideOpen]   = useState(false);

  const setF = (key, val) => setForm(f => ({ ...f, [key]: val }));

  // ── FS API: 폴더 선택 ──
  const handlePickFolder = async () => {
    setPicking(true);
    setFsError('');
    try {
      const name = await pickNasFolder();
      onConnect({ method: 'fs', folderName: name });
    } catch (err) {
      if (err.name !== 'AbortError') setFsError(err.message);
    } finally {
      setPicking(false);
    }
  };

  // ── FS API: 폴더 목록 ──
  const handleFsList = async () => {
    setFsLoading(true);
    setFsError('');
    try {
      const items = await listFsFolder();
      setFsItems(items);
    } catch (err) {
      setFsError(err.message);
    } finally {
      setFsLoading(false);
    }
  };

  // ── WebDAV: 연결 테스트 ──
  const handleDavTest = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await testNasConnection(form);
    setTesting(false);
    if (res.cors) {
      setTestResult({ ok: false, cors: true, message: 'CORS/오프라인: 브라우저 정책 또는 NAS 접근 불가' });
    } else {
      setTestResult(res);
    }
  };

  // ── WebDAV: 설정 저장 ──
  const handleDavSave = async () => {
    setSaving(true);
    const res = await testNasConnection(form);
    setSaving(false);
    if (res.ok) {
      saveNasConfig(form);
      onConnect({ method: 'webdav', connected: true, host: form.host, baseFolder: form.baseFolder });
    } else if (res.cors) {
      // CORS여도 설정은 저장 (환경에 따라 동작할 수 있음)
      saveNasConfig(form);
      onConnect({ method: 'webdav', connected: false, host: form.host, baseFolder: form.baseFolder });
    } else {
      setTestResult(res);
    }
  };

  const handleDisconnect = () => {
    clearDirHandle();
    clearNasConfig();
    setFsItems(null);
    setTestResult(null);
    onDisconnect();
  };

  return (
    <div className="p-6 space-y-6">

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-base font-bold text-gray-800">UGREEN NAS 연동</h4>
          <p className="text-xs text-gray-400 mt-0.5">방법을 선택해 NAS에 파일을 직접 저장하세요</p>
        </div>
        {nasState && (
          <button onClick={handleDisconnect} className="text-xs text-red-400 hover:text-red-600 transition-colors">
            연결 해제
          </button>
        )}
      </div>

      {/* ─── 방법 1: Docker 프록시 (dufs) ─── */}
      <div className={`rounded-xl border-2 p-5 space-y-4 transition-colors ${nasState?.method === 'docker' ? 'border-emerald-300 bg-emerald-50/40' : 'border-gray-200 bg-white'}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white">최고 권장</span>
              <p className="text-sm font-bold text-gray-800">Docker 프록시 (dufs)</p>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              NAS Docker에 <code className="bg-gray-100 px-1 rounded font-mono">dufs</code> 컨테이너를 실행하면<br/>
              CORS 완전 해결 + 파일이 NAS에 직접 저장됩니다.
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
            {/* Docker whale icon */}
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="3" height="3" rx="0.5"/><rect x="6" y="7" width="3" height="3" rx="0.5"/>
              <rect x="10" y="7" width="3" height="3" rx="0.5"/><rect x="6" y="3" width="3" height="3" rx="0.5"/>
              <path d="M22 12c0-1-1-2-2-2H2.5C2 12 2 13 2 13c0 3 2 5 5 5h9c3 0 5-2 6-4l.5-2z"/>
            </svg>
          </div>
        </div>

        {/* Docker 설정 안내 */}
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-2">
          <p className="text-xs font-semibold text-slate-700">① UGOS Docker에서 컨테이너 실행</p>
          <div className="space-y-1 text-xs text-slate-600">
            <p>UGOS → Docker → 컨테이너 → 추가 → 이미지 검색: <code className="bg-white border border-slate-200 px-1 rounded font-mono">sigoden/dufs</code></p>
            <p>또는 <strong>Compose</strong> 탭에서 아래 설정을 붙여넣기:</p>
          </div>
          <div className="relative">
            <pre className="text-[11px] font-mono bg-gray-900 text-green-400 rounded-lg p-3 overflow-x-auto leading-relaxed">{`services:
  eattack-nas-proxy:
    image: sigoden/dufs:latest
    ports:
      - "5055:5000"
    volumes:
      - /mnt/user_data/share/E-Attack:/data
    command: /data --allow-all --enable-cors
    restart: unless-stopped`}</pre>
            <p className="text-[10px] text-slate-400 mt-1">
              ⚠ <code className="font-mono">/mnt/user_data/share/E-Attack</code> 부분을 실제 NAS 공유폴더 경로로 변경하세요.<br/>
              UGOS File Manager → 폴더 우클릭 → 속성에서 경로 확인
            </p>
          </div>
          <p className="text-xs font-semibold text-slate-700 mt-2">② 실행 후 아래에서 연결 테스트</p>
        </div>

        {/* 연결 설정 */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">NAS IP</label>
            <input
              type="text"
              value={dockerHost}
              onChange={e => setDockerHost(e.target.value)}
              placeholder="192.168.1.100"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-400 transition-colors"
            />
          </div>
          <div className="w-24">
            <label className="block text-xs font-medium text-gray-600 mb-1">포트</label>
            <input
              type="text"
              value={dockerPort}
              onChange={e => setDockerPort(e.target.value)}
              placeholder="5055"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-400 transition-colors"
            />
          </div>
        </div>

        {dockerTestResult && (
          <div className={`rounded-lg border px-3 py-2.5 text-xs ${dockerTestResult.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-600'}`}>
            {dockerTestResult.ok ? `✓ ${dockerTestResult.message}` : `✕ ${dockerTestResult.message}`}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleDockerTest}
            disabled={!dockerHost || dockerTesting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-700 disabled:opacity-40 transition-colors"
          >
            {dockerTesting ? (
              <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            ) : null}
            {dockerTesting ? '테스트 중…' : '연결 테스트 및 저장'}
          </button>

          {nasState?.method === 'docker' && (
            <button
              onClick={handleDockerList}
              disabled={dockerLoading}
              className="px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {dockerLoading ? '로딩…' : '파일 목록'}
            </button>
          )}
        </div>

        {/* Docker 파일 목록 */}
        {dockerItems !== null && (
          <div className="rounded-lg border border-gray-200 overflow-hidden max-h-48 overflow-y-auto">
            {dockerItems.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">폴더가 비어 있습니다</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {dockerItems.map(item => (
                  <div key={item.href} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50">
                    {item.isDir ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>
                      </svg>
                    )}
                    <span className="text-xs text-gray-700 flex-1 truncate">{item.name}</span>
                    {!item.isDir && item.size > 0 && (
                      <span className="text-[11px] text-gray-400">{formatBytes(item.size)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 구분선 */}
      <div className="flex items-center gap-3">
        <div className="flex-1 border-t border-gray-200" />
        <span className="text-xs text-gray-400 font-medium">다른 방법</span>
        <div className="flex-1 border-t border-gray-200" />
      </div>

      {/* ─── 방법 2: 폴더 직접 선택 (FS API) ─── */}
      <div className={`rounded-xl border-2 p-5 space-y-4 transition-colors ${nasState?.method === 'fs' ? 'border-emerald-300 bg-emerald-50/40' : 'border-gray-200 bg-white'}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white">권장</span>
              <p className="text-sm font-bold text-gray-800">폴더 직접 선택</p>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              NAS를 Windows 네트워크 드라이브로 마운트한 뒤<br/>
              폴더를 선택하면 CORS 없이 바로 저장됩니다.
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
        </div>

        {!fsSupported ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            이 기능은 Chrome 86+ 에서만 지원됩니다. Chrome을 사용해주세요.
          </div>
        ) : (
          <>
            {/* NAS 마운트 안내 */}
            <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5 text-xs text-blue-700 space-y-1">
              <p className="font-semibold">① Windows에서 NAS 네트워크 드라이브 마운트 방법</p>
              <ol className="list-decimal list-inside space-y-0.5 text-blue-600 ml-1">
                <li>파일 탐색기 → 내 PC 우클릭 → <strong>네트워크 드라이브 연결</strong></li>
                <li>폴더: <code className="bg-blue-100 px-1 rounded font-mono">\\{'{'}NAS-IP{'}'}\shared</code></li>
                <li>연결 후 드라이브가 내 PC에 Z:\ 등으로 나타남</li>
              </ol>
              <p className="font-semibold mt-1">② 아래 버튼 클릭 → 탐색기에서 마운트된 NAS 폴더 선택</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handlePickFolder}
                disabled={picking}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {picking ? (
                  <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                )}
                NAS 폴더 선택
              </button>

              {nasState?.method === 'fs' && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-medium">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
                    {nasState.folderName}
                  </div>
                  <button
                    onClick={handleFsList}
                    disabled={fsLoading}
                    className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2"
                  >
                    {fsLoading ? '로딩…' : '목록 보기'}
                  </button>
                </div>
              )}
            </div>

            {fsError && <p className="text-xs text-red-500">{fsError}</p>}

            {/* 파일 목록 */}
            {fsItems !== null && (
              <div className="rounded-lg border border-gray-200 overflow-hidden max-h-48 overflow-y-auto">
                {fsItems.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">폴더가 비어 있습니다</p>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {fsItems.map(item => (
                      <div key={item.name} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50">
                        {item.isDir ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>
                          </svg>
                        )}
                        <span className="text-xs text-gray-700">{item.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── 방법 3: WebDAV ─── */}
      <div className={`rounded-xl border-2 transition-colors ${nasState?.method === 'webdav' ? 'border-blue-300' : 'border-gray-200'}`}>
        <button
          onClick={() => setDavOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50/80 transition-colors rounded-xl"
        >
          <div className="flex items-start gap-3 text-left">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-500 to-gray-600 flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/>
                <line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-bold text-gray-800">WebDAV 직접 연결</p>
                <span className="text-[10px] text-gray-400 font-medium">CORS 설정 필요</span>
              </div>
              <p className="text-xs text-gray-500">NAS IP·계정으로 WebDAV에 직접 접근합니다</p>
            </div>
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`text-gray-400 flex-shrink-0 transition-transform ${davOpen ? 'rotate-180' : ''}`}
          >
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </button>

        {davOpen && (
          <div className="px-5 pb-5 space-y-4 border-t border-gray-100">

            {/* CORS 경고 */}
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700 space-y-1 mt-4">
              <p className="font-semibold">⚠ 브라우저 CORS 제약</p>
              <p>브라우저에서 다른 IP(NAS)로 직접 요청하면 CORS 정책이 차단합니다.<br/>
              NAS WebDAV에 CORS 헤더를 추가하거나, 폴더 직접 선택 방식을 사용하세요.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">NAS IP</label>
                <input type="text" value={form.host} onChange={e => setF('host', e.target.value)}
                  placeholder="192.168.1.100"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-slate-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">포트</label>
                <input type="text" value={form.port} onChange={e => setF('port', e.target.value)}
                  placeholder="5006"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-slate-400" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">아이디</label>
                <input type="text" value={form.username} onChange={e => setF('username', e.target.value)}
                  placeholder="admin" autoComplete="username"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-slate-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">비밀번호</label>
                <input type="password" value={form.password} onChange={e => setF('password', e.target.value)}
                  placeholder="••••••••" autoComplete="current-password"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-slate-400" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">WebDAV 경로</label>
                <input type="text" value={form.davPath} onChange={e => setF('davPath', e.target.value)}
                  placeholder="/dav"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-slate-400 font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">기본 폴더</label>
                <input type="text" value={form.baseFolder} onChange={e => setF('baseFolder', e.target.value)}
                  placeholder="E-Attack"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-slate-400 font-mono" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setF('useHttps', !form.useHttps)}
                className={`relative w-9 h-5 rounded-full transition-colors ${form.useHttps ? 'bg-slate-600' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.useHttps ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-xs text-gray-600">HTTPS</span>
              {form.host && (
                <code className="ml-auto text-[11px] text-gray-400 font-mono">
                  {form.useHttps ? 'https' : 'http'}://{form.host}:{form.port}{form.davPath}
                </code>
              )}
            </div>

            {testResult && (
              <div className={`rounded-lg border px-3 py-2.5 text-xs ${testResult.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-600'}`}>
                {testResult.ok ? `✓ ${testResult.message}` : `✕ ${testResult.message}`}
                {testResult.cors && (
                  <p className="mt-1 text-red-500">NAS가 오프라인이거나 CORS가 차단됩니다. "폴더 직접 선택" 방식을 권장합니다.</p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleDavTest}
                disabled={!form.host || !form.username || testing}
                className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors flex items-center gap-2"
              >
                {testing ? <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> : null}
                {testing ? '테스트 중…' : '연결 테스트'}
              </button>
              <button
                onClick={handleDavSave}
                disabled={!form.host || !form.username || !form.password || saving}
                className="flex-1 px-4 py-2 rounded-lg bg-slate-700 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
              >
                {saving ? <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> : null}
                {saving ? '저장 중…' : '설정 저장 및 연결'}
              </button>
            </div>

            {/* UGREEN WebDAV 설정 가이드 */}
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setGuideOpen(o => !o)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-xs font-medium text-gray-600"
              >
                UGREEN WebDAV + CORS 설정 방법
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={`text-gray-400 transition-transform ${guideOpen ? 'rotate-180' : ''}`}>
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </button>
              {guideOpen && (
                <div className="px-4 py-4 space-y-3 text-xs text-gray-600 bg-white">
                  <div>
                    <p className="font-semibold text-gray-700 mb-1">① UGOS WebDAV 활성화</p>
                    <ol className="list-decimal list-inside space-y-0.5 text-gray-500 ml-2">
                      <li>UGOS 접속 <code className="bg-gray-100 px-1 rounded">http://[NAS-IP]:9999</code></li>
                      <li>앱 센터 → File Manager → 설정(⚙) → WebDAV 탭</li>
                      <li>WebDAV 활성화 체크 → HTTP 포트 <code className="bg-gray-100 px-1 rounded">5006</code></li>
                    </ol>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700 mb-1">② CORS 헤더 추가 (Nginx 예시)</p>
                    <code className="block bg-gray-50 border border-gray-200 rounded p-2 font-mono text-[11px] leading-relaxed">
                      add_header Access-Control-Allow-Origin *;<br/>
                      add_header Access-Control-Allow-Methods<br/>
                      {"  "}"GET,PUT,DELETE,PROPFIND,MKCOL,OPTIONS";<br/>
                      add_header Access-Control-Allow-Headers<br/>
                      {"  "}"Authorization,Depth,Content-Type";
                    </code>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 text-gray-500">
                    <div>WebDAV HTTP: <code className="bg-gray-100 px-1 rounded">5006</code></div>
                    <div>WebDAV HTTPS: <code className="bg-gray-100 px-1 rounded">5007</code></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 영상편집 자동화 탭 ────────────────────────────────────────────
function AutoEditTab({ nasState, onGoToNas }) {
  return (
    <div>
      <div className="flex flex-col items-center justify-center py-16 text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center mb-5 shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>
          </svg>
        </div>
        <h4 className="text-base font-semibold text-gray-700 mb-2">영상편집 자동화</h4>
        <p className="text-sm text-gray-400 max-w-xs">
          원본 영상을 업로드하면 AI가<br />자동 컷편집·자막·BGM 삽입을 처리합니다.<br />
          <span className="text-purple-500 font-medium">준비 중입니다</span>
        </p>
      </div>
      <NasSaveFooter nasState={nasState} subfolder="자동편집" onGoToNas={onGoToNas} />
    </div>
  );
}

// ── 풀그래픽영상 탭 ───────────────────────────────────────────────
function FullGraphicTab({ nasState, onGoToNas }) {
  return (
    <div>
      <div className="flex flex-col items-center justify-center py-16 text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center mb-5 shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="13.5" cy="6.5" r=".5" fill="white"/><circle cx="17.5" cy="10.5" r=".5" fill="white"/>
            <circle cx="8.5" cy="7.5" r=".5" fill="white"/><circle cx="6.5" cy="12.5" r=".5" fill="white"/>
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
          </svg>
        </div>
        <h4 className="text-base font-semibold text-gray-700 mb-2">풀그래픽영상</h4>
        <p className="text-sm text-gray-400 max-w-xs">
          텍스트와 이미지만 입력하면 AI가<br />모션그래픽 기반 풀그래픽 영상을 자동 생성합니다.<br />
          <span className="text-fuchsia-500 font-medium">준비 중입니다</span>
        </p>
      </div>
      <NasSaveFooter nasState={nasState} subfolder="풀그래픽" onGoToNas={onGoToNas} />
    </div>
  );
}

// ── 커뮤니티 영상 탭은 ./community/index.jsx 로 분리됨 ────────────

// ── 배경 영상 프리셋 (레거시 — community 폴더로 이전됨) ───────────
const BG_PRESETS = [
  { key: "minecraft", label: "마인크래프트", emoji: "⛏️", category: "게임",
    color: "from-green-500 to-emerald-600",
    desc: "파쿠르 & 서바이벌" },
  { key: "subway",    label: "서브웨이 서퍼", emoji: "🏃", category: "게임",
    color: "from-orange-500 to-red-500",
    desc: "무한 달리기 게임" },
  { key: "cooking",   label: "요리 영상",    emoji: "🍳", category: "요리",
    color: "from-yellow-500 to-orange-500",
    desc: "맛있는 요리 과정" },
  { key: "rain",      label: "빗소리",       emoji: "🌧️", category: "자연",
    color: "from-blue-400 to-slate-500",
    desc: "창문 빗소리 ASMR" },
  { key: "city",      label: "도시 야경",    emoji: "🌃", category: "야경",
    color: "from-purple-500 to-indigo-600",
    desc: "빛나는 도시 야경" },
  { key: "satisfying",label: "새틴파잉",     emoji: "✨", category: "힐링",
    color: "from-pink-400 to-rose-500",
    desc: "보는 것만으로 힐링" },
];

// 자막 폰트 옵션
const FONT_OPTIONS = [
  { key: "Noto Sans KR", label: "노토 산스 (기본)" },
  { key: "Black Han Sans", label: "검은 한 산스 (굵게)" },
  { key: "Gmarket Sans", label: "지마켓 산스" },
];

// 하이라이트 색상 프리셋
const HIGHLIGHT_COLORS = [
  { key: "#FFE600", label: "노랑" },
  { key: "#FF3D3D", label: "빨강" },
  { key: "#00FF9D", label: "연두" },
  { key: "#00CFFF", label: "하늘" },
  { key: "#FF6BF5", label: "분홍" },
  { key: "#FF8800", label: "주황" },
];

// 텍스트에서 자막 타이밍 자동 생성 (TTS 없이 데모용)
function generateCaptionsFromText(text) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const MS_PER_CHAR = 80; // 글자당 약 80ms
  const captions = [];
  let currentMs = 500; // 0.5초 인트로

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const duration = Math.max(300, word.length * MS_PER_CHAR);
    captions.push({
      text: i === 0 ? word : ` ${word}`,
      startMs: currentMs,
      endMs: currentMs + duration,
      timestampMs: currentMs,
      confidence: 1,
    });
    currentMs += duration + 50;
  }
  return { captions, totalMs: currentMs + 500 };
}

// 자막 미리보기 컴포넌트
function CaptionPreview({ script, highlightColor, fontFamily }) {
  const words = script.trim().split(/\s+/).filter(Boolean).slice(0, 12);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (words.length === 0) return;
    const interval = setInterval(() => {
      setActiveIdx(i => (i + 1) % words.length);
    }, 600);
    return () => clearInterval(interval);
  }, [words.length]);

  if (words.length === 0) {
    return (
      <div className="text-xs text-gray-400 text-center py-4">
        스크립트를 입력하면 자막 미리보기가 표시됩니다
      </div>
    );
  }

  return (
    <div
      className="rounded-xl overflow-hidden relative"
      style={{ aspectRatio: "9/16", maxHeight: 220, background: "#1a1a2e" }}
    >
      {/* 배경 그라디언트 시뮬레이션 */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
      {/* 자막 */}
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div
          className="rounded-xl px-4 py-2 text-center"
          style={{ background: "rgba(0,0,0,0.5)", fontFamily }}
        >
          <p className="text-white font-black leading-tight" style={{ fontSize: 18, textShadow: "0 0 8px #000" }}>
            {words.map((w, i) => (
              <span
                key={i}
                style={{ color: i === activeIdx ? highlightColor : "#fff", transition: "color 0.1s" }}
              >
                {i === 0 ? w : ` ${w}`}
              </span>
            ))}
          </p>
        </div>
      </div>
      {/* 9:16 레이블 */}
      <div className="absolute bottom-2 right-2 text-[9px] text-white/40 font-mono">9:16</div>
    </div>
  );
}

// ── (커뮤니티 영상 탭은 ./community/index.jsx 로 이전됨)

// ── 롱폼을 숏폼으로 탭 PLACEHOLDER (아래 실제 함수와 중복 방지용 제거)
// ── 롱폼을 숏폼으로 탭 ───────────────────────────────────────────
function LongToShortTab({ nasState, onGoToNas }) {
  const [step, setStep] = useState("input");
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [settings, setSettings] = useState({ length: 60, titleLang: "ko", subtitleLang: "ko" });
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [results, setResults] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");

  const templates = [
    { id: "dynamic", label: "다이나믹", desc: "빠른 컷 + 자막 강조" },
    { id: "calm", label: "잔잔한", desc: "부드러운 전환 + 미니멀 자막" },
    { id: "news", label: "뉴스형", desc: "하단 자막 바 + 정보 전달" },
  ];
  const lengthOptions = [
    { value: 30, label: "30초 이하" },
    { value: 60, label: "60초 이하" },
    { value: 90, label: "90초 이하" },
    { value: 180, label: "3분 이하" },
  ];
  const langOptions = [
    { value: "ko", label: "한국어" },
    { value: "en", label: "영어" },
    { value: "ja", label: "일본어" },
  ];

  const validateUrl = (v) =>
    /^https?:\/\/(www\.)?(youtube\.com\/watch|youtu\.be\/)/.test(v);

  const handleConvert = () => {
    if (!validateUrl(url)) { setUrlError("YouTube URL을 정확히 입력해 주세요."); return; }
    setUrlError("");
    setStep("settings");
  };

  const pollStatus = (jobId) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:8000/status/${jobId}`);
        const data = await res.json();
        setProgress(data.progress || 0);
        setProgressMsg(data.message || "");
        if (data.status === "done") {
          clearInterval(interval);
          setResults(data.results || []);
          setStep("result");
        } else if (data.status === "error") {
          clearInterval(interval);
          setErrorMsg(data.message || "오류가 발생했습니다.");
          setStep("error");
        }
      } catch (e) {
        clearInterval(interval);
        setErrorMsg("서버 연결 실패. localhost:8000 확인해 주세요.");
        setStep("error");
      }
    }, 1500);
  };

  const handleGenerate = async () => {
    if (!selectedTemplate) return;
    setStep("loading");
    setProgress(0);
    setProgressMsg("시작 중...");
    try {
      const res = await fetch("http://localhost:8000/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          length: settings.length,
          title_lang: settings.titleLang,
          subtitle_lang: settings.subtitleLang,
          template: selectedTemplate,
        }),
      });
      const data = await res.json();
      pollStatus(data.job_id);
    } catch (e) {
      setErrorMsg("서버 연결 실패. localhost:8000 확인해 주세요.");
      setStep("error");
    }
  };

  const handleReset = () => {
    setStep("input"); setUrl(""); setSelectedTemplate(null);
    setResults([]); setErrorMsg(""); setProgress(0);
  };

  if (step === "input") return (
    <div className="flex flex-col items-center justify-center py-12 gap-6 px-4">
      <div className="text-center">
        <p className="text-lg font-semibold text-gray-800">YouTube URL을 입력하세요</p>
        <p className="text-sm text-gray-500 mt-1">AI가 핵심 장면을 추출해 쇼츠·릴스로 변환합니다</p>
      </div>
      <div className="w-full max-w-lg flex flex-col gap-2">
        <div className="flex gap-2">
          <input type="text"
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            placeholder="https://www.youtube.com/watch?v=..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleConvert()}
          />
          <button onClick={handleConvert}
            className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-5 py-2 rounded-lg font-medium transition-colors">
            변환하기
          </button>
        </div>
        {urlError && <p className="text-xs text-red-500">{urlError}</p>}
      </div>
    </div>
  );

  if (step === "settings") return (
    <div className="flex flex-col gap-5 px-4 py-6 max-w-lg mx-auto w-full">
      <p className="text-sm font-semibold text-gray-700">변환 설정</p>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">쇼츠 길이</label>
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={settings.length}
          onChange={(e) => setSettings({ ...settings, length: Number(e.target.value) })}>
          {lengthOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">제목 언어</label>
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={settings.titleLang}
          onChange={(e) => setSettings({ ...settings, titleLang: e.target.value })}>
          {langOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">자막 언어</label>
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={settings.subtitleLang}
          onChange={(e) => setSettings({ ...settings, subtitleLang: e.target.value })}>
          {langOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-xs text-gray-500">템플릿 선택</label>
        <div className="flex gap-2">
          {templates.map((t) => (
            <button key={t.id} onClick={() => setSelectedTemplate(t.id)}
              className={`flex-1 border rounded-lg px-3 py-2 text-sm text-left transition-all ${selectedTemplate === t.id ? "border-purple-500 bg-purple-50 text-purple-700" : "border-gray-300 text-gray-700 hover:border-purple-300"}`}>
              <p className="font-medium">{t.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={() => setStep("input")}
          className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">이전</button>
        <button onClick={handleGenerate} disabled={!selectedTemplate}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${selectedTemplate ? "bg-purple-600 hover:bg-purple-700 text-white" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}>
          쇼츠 생성하기
        </button>
      </div>
    </div>
  );

  if (step === "loading") return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 px-4">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-2xl animate-pulse">✂️</div>
      <p className="text-sm font-semibold text-gray-700">쇼츠 변환 중...</p>
      <div className="w-full max-w-sm bg-gray-200 rounded-full h-2">
        <div className="bg-purple-500 h-2 rounded-full transition-all duration-700" style={{ width: progress + "%" }} />
      </div>
      <p className="text-xs text-gray-400">{progress}% 완료</p>
      <p className="text-xs text-gray-400">{progressMsg}</p>
    </div>
  );

  if (step === "error") return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 px-4">
      <p className="text-sm text-red-500 font-semibold">오류 발생</p>
      <p className="text-xs text-gray-500 text-center">{errorMsg}</p>
      <button onClick={handleReset} className="text-sm text-purple-600 hover:underline">다시 시도</button>
    </div>
  );

  if (step === "result") return (
    <div className="flex flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">변환 완료 — {results.length}개 쇼츠</p>
        <button onClick={handleReset} className="text-xs text-purple-600 hover:underline">새 변환</button>
      </div>
      <div className="flex flex-col gap-3">
        {results.map((r) => (
          <div key={r.id} className="flex items-center gap-3 border border-gray-200 rounded-xl p-3">
            <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center text-xl">🎬</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{r.title}</p>
              <p className="text-xs text-gray-400">{r.duration}</p>
              <p className="text-xs text-gray-400 truncate">{r.text}</p>
            </div>
            <div className="flex gap-1">
              <a href={`http://localhost:8000${r.url}`} target="_blank" rel="noopener noreferrer"
                className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-lg">편집</a>
              <button
                onClick={() => nasState?.connected ? onGoToNas() : alert("NAS를 먼저 연결해 주세요.")}
                className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-2 py-1 rounded-lg">저장</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return null;
}

export default function VideoPage({ onBack }) {
  const [activeTab, setActiveTab] = useState("nas");

  /**
   * nasState: null | { method: 'fs', folderName } | { method: 'webdav', connected, host, baseFolder }
   * 페이지 새로고침 시 FS 핸들은 사라지므로, webdav 설정만 localStorage에서 복원
   */
  const [nasState, setNasState] = useState(() => {
    const cfg = getNasConfig();
    if (!cfg) return null;
    return { method: 'webdav', connected: false, host: cfg.host, baseFolder: cfg.baseFolder };
  });

  const handleConnect = useCallback((state) => {
    setNasState(state);
  }, []);

  const handleDisconnect = useCallback(() => {
    setNasState(null);
  }, []);

  const goToNas = () => setActiveTab("nas");

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-8 sm:py-12">

        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-md flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11"/><rect x="2" y="6" width="14" height="12" rx="2"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-gray-800">영상 콘텐츠</h3>
                <NasBadge nasState={nasState} />
              </div>
              <p className="text-sm text-gray-400">제작할 영상 유형을 선택하세요</p>
            </div>
          </div>
        </div>

        {/* 탭 선택 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {VIDEO_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative group text-left p-5 rounded-2xl border-2 transition-all duration-200 ${
                activeTab === tab.key
                  ? "border-purple-400 bg-purple-50 shadow-md"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tab.gradient} flex items-center justify-center shadow-sm flex-shrink-0 text-white`}>
                  {tab.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className={`text-sm font-bold ${activeTab === tab.key ? "text-purple-700" : "text-gray-800"}`}>
                      {tab.label}
                    </p>
                    {activeTab === tab.key && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500 text-white">선택됨</span>
                    )}
                    {tab.key !== "nas" && nasState && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700">
                        <span className="w-1 h-1 rounded-full bg-emerald-500" />NAS
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{tab.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* 탭 컨텐츠 */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          {/* 탭 바 */}
          <div className="flex border-b border-gray-100 overflow-x-auto">
            {VIDEO_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all border-b-2 -mb-px whitespace-nowrap ${
                  activeTab === tab.key
                    ? "border-purple-500 text-purple-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <span className={`[&>svg]:w-4 [&>svg]:h-4 ${activeTab === tab.key ? "text-purple-500" : "text-gray-400"}`}>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* 탭 내용 */}
          {activeTab === "nas"         && <NasTab nasState={nasState} onConnect={handleConnect} onDisconnect={handleDisconnect} />}
          {activeTab === "autoedit"    && <AutoEditTab    nasState={nasState} onGoToNas={goToNas} />}
          {activeTab === "fullgraphic" && <FullGraphicTab nasState={nasState} onGoToNas={goToNas} />}
          {activeTab === "community"   && <CommunityTab   nasState={nasState} onGoToNas={goToNas} />}
          {activeTab === "longshort"   && <LongToShortTab nasState={nasState} onGoToNas={goToNas} />}
        </div>

      </div>
    </div>
  );
}
