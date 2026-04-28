// 관리자 페이지
// - 사용자 관리 (추가/수정/삭제)
// - 소셜 계정 API 연동 (인스타그램 · 스레드 per user)
// - AI API 키 관리 (Gemini, Claude, OpenAI 등)
import { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
import { USERS as SEED_USERS } from "../config/users";
import { PRESET_PROVIDERS, loadAiKeys, saveAiKeys } from "../utils/aiKeys";
import { COUPANG_KEY, loadCoupangCreds } from "../utils/coupang";

// ── 스토리지 키 ──
const USERS_KEY    = "eden_users_v1";
const igKey        = (u) => `eden_ig_${u}_v1`;
const threadsKey   = (u) => `eden_threads_${u}_v1`;
const fullAutoKey  = (u) => `eden_fullauto_${u}_v1`;
function saveCoupangCreds(data) { localStorage.setItem(COUPANG_KEY, JSON.stringify(data)); }

// ── 사용자 목록 로드 (최초 1회 seed 주입) ──
function loadUsers() {
  try {
    const saved = JSON.parse(localStorage.getItem(USERS_KEY));
    if (saved && saved.length > 0) return saved;
  } catch { /* localStorage 파싱 실패 시 seed 사용 */ }
  // 첫 실행: config 파일 seed 사용
  localStorage.setItem(USERS_KEY, JSON.stringify(SEED_USERS));
  return [...SEED_USERS];
}
function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

// ── 소셜 계정 로드/저장 ──
function loadSocial(keyFn, username) {
  try { return JSON.parse(localStorage.getItem(keyFn(username))) || {}; }
  catch { return {}; }
}
function saveSocial(keyFn, username, data) {
  localStorage.setItem(keyFn(username), JSON.stringify(data));
}

// ── 풀가동화 설정 로드/저장 ──
function loadFullAuto(username) {
  try { return JSON.parse(localStorage.getItem(fullAutoKey(username))) || {}; }
  catch { return {}; }
}
function saveFullAutoSettings(username, data) {
  localStorage.setItem(fullAutoKey(username), JSON.stringify(data));
}

// ── 공통 입력 ──
function Field({ label, type = "text", value, onChange, placeholder, mono }) {
  return (
    <div>
      <label className="text-xs font-bold text-gray-600 block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-purple-400 bg-white transition-colors ${mono ? "font-mono" : ""}`}
      />
    </div>
  );
}

// ═══════════════════════════════════════════
// 탭 1: 사용자 관리
// ═══════════════════════════════════════════
function UsersTab() {
  const [users, setUsers]         = useState(loadUsers);
  const [editId, setEditId]       = useState(null); // 편집 중인 username
  const [editData, setEditData]   = useState({});
  const [showAdd, setShowAdd]     = useState(false);
  const [newUser, setNewUser]     = useState({ username: "", password: "", displayName: "" });
  const [saved, setSaved]         = useState(false);

  const persist = (next) => {
    setUsers(next);
    saveUsers(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  // 편집 시작
  const startEdit = (u) => {
    setEditId(u.username);
    setEditData({ ...u });
  };

  // 편집 저장
  const commitEdit = () => {
    if (!editData.username.trim() || !editData.password.trim()) return;
    persist(users.map((u) => (u.username === editId ? { ...editData } : u)));
    setEditId(null);
  };

  // 삭제
  const deleteUser = (username) => {
    if (users.length <= 1) { alert("최소 1명의 사용자가 필요합니다"); return; }
    if (!confirm(`"${username}" 계정을 삭제할까요?`)) return;
    persist(users.filter((u) => u.username !== username));
  };

  // 추가
  const addUser = () => {
    if (!newUser.username.trim() || !newUser.password.trim() || !newUser.displayName.trim()) {
      alert("아이디, 비밀번호, 이름을 모두 입력하세요");
      return;
    }
    if (users.some((u) => u.username === newUser.username.trim())) {
      alert("이미 존재하는 아이디입니다");
      return;
    }
    persist([...users, { ...newUser, username: newUser.username.trim() }]);
    setNewUser({ username: "", password: "", displayName: "" });
    setShowAdd(false);
  };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-800">사용자 계정</h3>
          <p className="text-xs text-gray-400 mt-0.5">총 {users.length}명</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-xs text-green-600 font-medium bg-green-50 border border-green-200 rounded-lg px-2.5 py-1">
              저장 완료
            </span>
          )}
          <button
            onClick={() => { setShowAdd(!showAdd); setEditId(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14"/><path d="M12 5v14"/>
            </svg>
            사용자 추가
          </button>
        </div>
      </div>

      {/* 추가 폼 */}
      {showAdd && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-bold text-purple-700">새 사용자 추가</p>
          <div className="grid grid-cols-3 gap-3">
            <Field label="아이디" value={newUser.username} onChange={(v) => setNewUser((p) => ({ ...p, username: v }))} placeholder="영문/숫자" />
            <Field label="비밀번호" type="password" value={newUser.password} onChange={(v) => setNewUser((p) => ({ ...p, password: v }))} placeholder="비밀번호" />
            <Field label="이름" value={newUser.displayName} onChange={(v) => setNewUser((p) => ({ ...p, displayName: v }))} placeholder="표시될 이름" />
          </div>
          <div className="flex gap-2">
            <button onClick={addUser} className="px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 transition-all">추가</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-all">취소</button>
          </div>
        </div>
      )}

      {/* 사용자 테이블 */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {["이름", "아이디", "비밀번호", ""].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map((u) =>
              editId === u.username ? (
                // ── 인라인 편집 행 ──
                <tr key={u.username} className="bg-purple-50/50">
                  <td className="px-4 py-2">
                    <input
                      className="w-full px-2 py-1.5 text-xs border border-purple-200 rounded-lg outline-none focus:border-purple-400"
                      value={editData.displayName}
                      onChange={(e) => setEditData((p) => ({ ...p, displayName: e.target.value }))}
                      placeholder="이름"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      className="w-full px-2 py-1.5 text-xs border border-purple-200 rounded-lg outline-none focus:border-purple-400 font-mono"
                      value={editData.username}
                      onChange={(e) => setEditData((p) => ({ ...p, username: e.target.value }))}
                      placeholder="아이디"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      className="w-full px-2 py-1.5 text-xs border border-purple-200 rounded-lg outline-none focus:border-purple-400"
                      value={editData.password}
                      onChange={(e) => setEditData((p) => ({ ...p, password: e.target.value }))}
                      placeholder="비밀번호"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1.5">
                      <button onClick={commitEdit} className="px-3 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700">저장</button>
                      <button onClick={() => setEditId(null)} className="px-3 py-1.5 border border-gray-200 text-gray-500 text-xs rounded-lg hover:bg-gray-50">취소</button>
                    </div>
                  </td>
                </tr>
              ) : (
                // ── 일반 행 ──
                <tr key={u.username} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-4 py-3 font-semibold text-gray-800">{u.displayName}</td>
                  <td className="px-4 py-3 font-mono text-gray-600 text-xs">{u.username}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{"•".repeat(Math.min(u.password.length, 10))}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(u)} className="px-2.5 py-1 text-[11px] font-semibold border border-gray-200 text-gray-500 rounded-lg hover:border-purple-300 hover:text-purple-600 transition-all">수정</button>
                      <button onClick={() => deleteUser(u.username)} className="px-2.5 py-1 text-[11px] font-semibold border border-gray-200 text-red-400 rounded-lg hover:border-red-200 hover:bg-red-50 transition-all">삭제</button>
                    </div>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-gray-400">
        변경 사항은 즉시 브라우저에 저장됩니다. 비밀번호는 평문 저장 (내부 도구용).
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════
// 탭 2: 소셜 계정 API 연동
// ═══════════════════════════════════════════
function SocialTab() {
  const [users, setUsers] = useState(loadUsers);
  const [selectedUser, setSelectedUser] = useState(() => loadUsers()[0]?.username || "");

  // 팀원 추가/편집 상태
  const [editingId, setEditingId] = useState(null);   // username | "__new__" | null
  const [editForm, setEditForm] = useState({ username: "", displayName: "", password: "" });

  // Instagram 상태
  const [ig, setIg] = useState(() => loadSocial(igKey, loadUsers()[0]?.username || ""));
  // Threads 상태
  const [th, setTh] = useState(() => loadSocial(threadsKey, loadUsers()[0]?.username || ""));
  // 풀가동화 설정
  const [fa, setFa] = useState(() => loadFullAuto(loadUsers()[0]?.username || ""));

  const [igSaved, setIgSaved] = useState(false);
  const [thSaved, setThSaved] = useState(false);
  const [faSaved, setFaSaved] = useState(false);
  const [thFetching, setThFetching] = useState(false);
  const [logs, setLogs] = useState([]);

  // 사용자 변경 시 해당 사용자의 API 설정 로드
  const handleUserChange = (username) => {
    setSelectedUser(username);
    setIg(loadSocial(igKey, username));
    setTh(loadSocial(threadsKey, username));
    setFa(loadFullAuto(username));
    setIgSaved(false);
    setThSaved(false);
    setFaSaved(false);
    setEditingId(null);
  };

  // ── 팀원 추가 시작 ──
  const startAdd = () => {
    setEditingId("__new__");
    setEditForm({ username: "", displayName: "", password: "" });
  };

  // ── 팀원 편집 시작 ──
  const startEdit = (u) => {
    setEditingId(u.username);
    setEditForm({ username: u.username, displayName: u.displayName, password: u.password });
  };

  // ── 팀원 저장 (추가/수정) ──
  const commitEdit = () => {
    const name = editForm.displayName.trim();
    const uid  = editForm.username.trim();
    const pw   = editForm.password.trim();
    if (!name) { alert("이름을 입력하세요"); return; }

    let next;
    if (editingId === "__new__") {
      // 새 팀원: username 자동 생성 (없으면)
      const newUid = uid || `user_${Date.now()}`;
      if (users.some((u) => u.username === newUid)) {
        alert("이미 사용 중인 아이디입니다");
        return;
      }
      const newUser = { username: newUid, displayName: name, password: pw || "1234" };
      next = [...users, newUser];
      setTimeout(() => handleUserChange(newUid), 0);
    } else {
      // 기존 팀원 수정 — 아이디 변경 시 localStorage 키도 마이그레이션
      const newUid = uid || editingId;
      if (newUid !== editingId && users.some((u) => u.username === newUid)) {
        alert("이미 사용 중인 아이디입니다");
        return;
      }
      if (newUid !== editingId) {
        // 소셜 데이터를 새 키로 복사 후 구 키 삭제
        [igKey, threadsKey, fullAutoKey].forEach((keyFn) => {
          const data = localStorage.getItem(keyFn(editingId));
          if (data) localStorage.setItem(keyFn(newUid), data);
          localStorage.removeItem(keyFn(editingId));
        });
      }
      next = users.map((u) =>
        u.username === editingId
          ? { username: newUid, displayName: name, password: pw || u.password }
          : u
      );
      if (selectedUser === editingId) {
        setTimeout(() => handleUserChange(newUid), 0);
      }
    }
    saveUsers(next);
    setUsers(next);
    setEditingId(null);
  };

  // ── 팀원 삭제 ──
  const deleteUser = (username) => {
    if (users.length <= 1) { alert("최소 1명은 있어야 합니다"); return; }
    if (!confirm(`삭제하시겠습니까?`)) return;
    const next = users.filter((u) => u.username !== username);
    saveUsers(next);
    setUsers(next);
    if (selectedUser === username) {
      handleUserChange(next[0]?.username || "");
    }
  };

  const addLog = (type, msg) =>
    setLogs(prev => [{ type, msg, time: new Date() }, ...prev].slice(0, 80));

  const fetchThUserId = async () => {
    if (!th.accessToken?.trim()) { addLog("error", "액세스 토큰을 먼저 입력하세요"); return; }
    setThFetching(true);
    try {
      const res = await fetch(
        `https://graph.threads.net/v1.0/me?fields=id,username&access_token=${th.accessToken.trim()}`
      );
      const data = await res.json();
      if (!res.ok || !data.id) throw new Error(data.error?.message || "조회 실패");
      setTh(p => ({ ...p, userId: data.id }));
      addLog("info", `Threads @${data.username} → ID: ${data.id} 조회 완료`);
    } catch (e) {
      addLog("error", `Threads ID 조회 실패: ${e.message}`);
    } finally {
      setThFetching(false);
    }
  };

  const saveIg = () => {
    saveSocial(igKey, selectedUser, ig);
    setIgSaved(true);
    setTimeout(() => setIgSaved(false), 2000);
    addLog("info", `Instagram 설정 저장됨 (${selectedUser})`);
  };

  const saveTh = () => {
    saveSocial(threadsKey, selectedUser, th);
    setThSaved(true);
    setTimeout(() => setThSaved(false), 2000);
    addLog("info", `Threads 설정 저장됨 (${selectedUser})`);
  };

  const saveFa = () => {
    saveFullAutoSettings(selectedUser, fa);
    setFaSaved(true);
    setTimeout(() => setFaSaved(false), 2000);
    addLog("info", `풀가동화 템플릿 저장됨 (${selectedUser})`);
  };

  const currentUser = users.find((u) => u.username === selectedUser);

  return (
    <div className="space-y-5">
      {/* ── 팀원 선택/관리 ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-gray-600">팀원 선택</p>
          <button
            onClick={startAdd}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"/><path d="M12 5v14"/>
            </svg>
            팀원 추가
          </button>
        </div>

        {/* 팀원 칩 목록 */}
        <div className="flex flex-wrap gap-2">
          {users.map((u) => (
            <div key={u.username} className="relative group">
              <button
                onClick={() => handleUserChange(u.username)}
                className={`flex items-center gap-2 pl-3 pr-8 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                  selectedUser === u.username
                    ? "border-purple-400 bg-purple-50 text-purple-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                  {u.displayName.charAt(0)}
                </div>
                {u.displayName}
              </button>
              {/* 편집/삭제 버튼 — hover 시 표시 */}
              <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); startEdit(u); }}
                  className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-purple-600 hover:bg-purple-100 transition-all"
                  title="이름 수정"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                  </svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteUser(u.username); }}
                  className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                  title="삭제"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 인라인 편집/추가 폼 */}
        {editingId !== null && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs font-semibold text-purple-700 mb-2">
              {editingId === "__new__" ? "새 팀원 추가" : "팀원 정보 수정"}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-bold text-gray-500 block mb-1">이름 *</label>
                <input
                  autoFocus
                  className="w-full px-2.5 py-2 text-sm border border-purple-200 rounded-lg outline-none focus:border-purple-400"
                  placeholder="홍길동"
                  value={editForm.displayName}
                  onChange={(e) => setEditForm((p) => ({ ...p, displayName: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && commitEdit()}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 block mb-1">
                  아이디{editingId === "__new__" ? " (선택)" : ""}
                </label>
                <input
                  className="w-full px-2.5 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-purple-400 font-mono"
                  placeholder={editingId === "__new__" ? "자동생성" : editingId}
                  value={editForm.username}
                  onChange={(e) => setEditForm((p) => ({ ...p, username: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && commitEdit()}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 block mb-1">비밀번호</label>
                <input
                  type="text"
                  className="w-full px-2.5 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-purple-400"
                  placeholder={editingId === "__new__" ? "1234" : "변경 시 입력"}
                  value={editForm.password}
                  onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && commitEdit()}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={commitEdit}
                className="px-4 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 transition-all"
              >
                {editingId === "__new__" ? "추가" : "저장"}
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="px-4 py-1.5 border border-gray-200 text-gray-500 text-xs rounded-lg hover:bg-gray-50 transition-all"
              >
                취소
              </button>
            </div>
          </div>
        )}
      </div>

      {currentUser && (
        <>
          {/* ── Instagram ── */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-pink-50 to-orange-50">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 to-orange-400 flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">인스타그램</p>
                <p className="text-[11px] text-gray-400">Instagram Business Graph API</p>
              </div>
              {ig.accountId && ig.accessToken && (
                <span className="ml-auto text-[10px] font-bold bg-green-100 text-green-600 border border-green-200 rounded-full px-2 py-0.5">연동됨</span>
              )}
            </div>
            <div className="p-5 space-y-3">
              <Field
                label="비즈니스 계정 ID (Instagram User ID)"
                value={ig.accountId || ""}
                onChange={(v) => setIg((p) => ({ ...p, accountId: v }))}
                placeholder="예: 17841400000000000"
                mono
              />
              <Field
                label="액세스 토큰 (Long-lived Access Token)"
                type="password"
                value={ig.accessToken || ""}
                onChange={(v) => setIg((p) => ({ ...p, accessToken: v }))}
                placeholder="EAAxxxxxxxxxxxxxxx..."
                mono
              />
              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-gray-400">
                  Meta Business Suite → 설정 → Instagram → API 액세스 토큰
                </p>
                <button
                  onClick={saveIg}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                    igSaved
                      ? "bg-green-500 text-white"
                      : "bg-pink-500 hover:bg-pink-600 text-white"
                  }`}
                >
                  {igSaved ? "✓ 저장됨" : "저장"}
                </button>
              </div>
            </div>
          </div>

          {/* ── Threads ── */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-slate-50">
              <div className="w-8 h-8 rounded-xl bg-gray-900 flex items-center justify-center flex-shrink-0">
                {/* Threads 아이콘 (@ 심볼) */}
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4"/>
                  <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">스레드 (Threads)</p>
                <p className="text-[11px] text-gray-400">Meta Threads API v1.0</p>
              </div>
              {th.userId && th.accessToken && (
                <span className="ml-auto text-[10px] font-bold bg-green-100 text-green-600 border border-green-200 rounded-full px-2 py-0.5">연동됨</span>
              )}
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Threads 사용자 ID</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={th.userId || ""}
                    onChange={(e) => setTh((p) => ({ ...p, userId: e.target.value }))}
                    placeholder="예: 1234567890"
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-purple-400 bg-white transition-colors font-mono"
                  />
                  <button
                    onClick={fetchThUserId}
                    disabled={thFetching || !th.accessToken?.trim()}
                    className="px-3 py-2 text-xs font-bold border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-all whitespace-nowrap"
                  >
                    {thFetching ? "조회 중..." : "ID 조회"}
                  </button>
                </div>
              </div>
              <Field
                label="액세스 토큰 (Threads Access Token)"
                type="password"
                value={th.accessToken || ""}
                onChange={(v) => setTh((p) => ({ ...p, accessToken: v }))}
                placeholder="THxxxxxxxxxxxxxxx..."
                mono
              />
              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-gray-400">
                  Meta Developers → Threads API → 앱 토큰 생성
                </p>
                <button
                  onClick={saveTh}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                    thSaved
                      ? "bg-green-500 text-white"
                      : "bg-gray-900 hover:bg-gray-700 text-white"
                  }`}
                >
                  {thSaved ? "✓ 저장됨" : "저장"}
                </button>
              </div>
            </div>
          </div>

          {/* ── 풀가동화 콘텐츠 설정 ── */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-amber-50">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">풀가동화 콘텐츠 설정</p>
                <p className="text-[11px] text-gray-400">E-Attack 풀가동화 파이프라인 기본 설정</p>
              </div>
              {fa.topics && (
                <span className="ml-auto text-[10px] font-bold bg-orange-100 text-orange-600 border border-orange-200 rounded-full px-2 py-0.5">설정됨</span>
              )}
            </div>
            <div className="p-5 space-y-3">
              <Field
                label="토픽 키워드 (쉼표로 구분)"
                value={fa.topics || ""}
                onChange={(v) => setFa((p) => ({ ...p, topics: v }))}
                placeholder="마케팅 자동화, SNS 운영, 디지털 마케팅"
              />
              <Field
                label="브랜드명"
                value={fa.brandName || ""}
                onChange={(v) => setFa((p) => ({ ...p, brandName: v }))}
                placeholder="에덴 에이전트"
              />
              <Field
                label="톤앤매너 (자유 입력)"
                value={fa.tone || ""}
                onChange={(v) => setFa((p) => ({ ...p, tone: v }))}
                placeholder="친근하고 전문적인"
              />

              {/* Threads 자동화 템플릿 */}
              <div className="pt-1 border-t border-gray-100">
                <p className="text-[11px] font-bold text-gray-500 mb-2">Threads 자동화 템플릿</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 block mb-1">포맷</label>
                    <select
                      value={fa.format || "expert"}
                      onChange={(e) => setFa(p => ({ ...p, format: e.target.value }))}
                      className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-purple-400 bg-white"
                    >
                      <option value="expert">전문가 설명</option>
                      <option value="friend">친구 조언</option>
                      <option value="story">경험담</option>
                      <option value="question">질문 유도</option>
                      <option value="checklist">체크리스트</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 block mb-1">말투</label>
                    <select
                      value={fa.threadsTone || "template"}
                      onChange={(e) => setFa(p => ({ ...p, threadsTone: e.target.value }))}
                      className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-purple-400 bg-white"
                    >
                      <option value="template">템플릿 말투</option>
                      <option value="direct">직설적</option>
                      <option value="warm">따뜻한 공감</option>
                      <option value="bold">도발적</option>
                      <option value="casual">캐주얼</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 block mb-1">흐름</label>
                    <select
                      value={fa.flow || "template"}
                      onChange={(e) => setFa(p => ({ ...p, flow: e.target.value }))}
                      className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-purple-400 bg-white"
                    >
                      <option value="template">템플릿 흐름</option>
                      <option value="problem">문제→해결</option>
                      <option value="value">가치 선제시</option>
                      <option value="story">상황→깨달음</option>
                      <option value="contrarian">반전 주장</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 block mb-1">CTA</label>
                    <select
                      value={fa.cta || "template"}
                      onChange={(e) => setFa(p => ({ ...p, cta: e.target.value }))}
                      className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-purple-400 bg-white"
                    >
                      <option value="template">템플릿 CTA</option>
                      <option value="comment">댓글 유도</option>
                      <option value="follow">팔로우 유도</option>
                      <option value="save">저장 유도</option>
                      <option value="dm">DM 유도</option>
                      <option value="soft">부드러운 권유</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">슬라이드 수 (1–10)</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={fa.slideCount || 5}
                  onChange={(e) => setFa((p) => ({ ...p, slideCount: Number(e.target.value) }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-purple-400 bg-white transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">캡션 템플릿</label>
                <textarea
                  rows={3}
                  value={fa.captionTemplate || "{title}\n\n{body}\n\n#마케팅 #자동화"}
                  onChange={(e) => setFa((p) => ({ ...p, captionTemplate: e.target.value }))}
                  placeholder="{title}\n\n{body}\n\n#마케팅 #자동화"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-purple-400 bg-white transition-colors resize-none"
                />
                <p className="text-[11px] text-gray-400 mt-1">{"{title}"} = 첫 슬라이드 제목, {"{body}"} = 슬라이드 목차</p>
              </div>
              <div className="flex items-center justify-end pt-1">
                <button
                  onClick={saveFa}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                    faSaved
                      ? "bg-green-500 text-white"
                      : "bg-orange-500 hover:bg-orange-600 text-white"
                  }`}
                >
                  {faSaved ? "✓ 저장됨" : "저장"}
                </button>
              </div>
            </div>
          </div>

          {/* ── 소셜 로그 패널 ── */}
          <div className="bg-gray-950 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800">
              <p className="text-xs font-bold text-gray-400">소셜 계정 로그 · {currentUser?.displayName}</p>
              {logs.length > 0 && (
                <button
                  onClick={() => setLogs([])}
                  className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors"
                >
                  지우기
                </button>
              )}
            </div>
            <div className="p-3 min-h-[48px] max-h-52 overflow-y-auto space-y-1 font-mono">
              {logs.length === 0 ? (
                <p className="text-[11px] text-gray-600 py-1">저장·조회 시 여기에 로그가 표시됩니다.</p>
              ) : logs.map((l, i) => (
                <div key={i} className="flex gap-2 text-[11px] leading-relaxed">
                  <span className="text-gray-600 flex-shrink-0">{l.time.toLocaleTimeString("ko-KR")}</span>
                  <span className={`flex-shrink-0 font-bold ${l.type === "error" ? "text-red-400" : "text-emerald-400"}`}>
                    {l.type === "error" ? "ERR" : "LOG"}
                  </span>
                  <span className={l.type === "error" ? "text-red-300" : "text-gray-200"}>{l.msg}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-gray-400">
            🔒 API 키와 설정은 사용자별로 브라우저 로컬에 저장됩니다.
          </p>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// 탭 3: AI API 키 관리
// ═══════════════════════════════════════════
function AiApiTab() {
  // 저장된 키 목록 (배열). 없으면 빈 배열.
  const [keys, setKeys] = useState(() => loadAiKeys());
  // 추가 패널: null | 'pick' (프리셋 선택) | 'custom' (직접 입력)
  const [addMode, setAddMode] = useState(null);
  const [customForm, setCustomForm] = useState({ id: '', name: '', apiKey: '', model: '' });
  // 비밀 보기 토글
  const [showKey, setShowKey] = useState({});

  const configuredIds = keys.map(k => k.id);
  const availablePresets = PRESET_PROVIDERS.filter(p => !configuredIds.includes(p.id));

  const update = (id, field, value) => {
    setKeys(prev => {
      const next = prev.map(k => k.id === id ? { ...k, [field]: value } : k);
      saveAiKeys(next);
      return next;
    });
  };

  const addPreset = (preset) => {
    setKeys(prev => {
      const next = [...prev, {
        id: preset.id,
        name: preset.name,
        apiKey: '',
        model: preset.defaultModel,
        enabled: true,
        custom: false,
      }];
      saveAiKeys(next);
      return next;
    });
    setAddMode(null);
  };

  const addCustom = () => {
    const id = customForm.id.trim() || `custom_${Date.now()}`;
    if (keys.some(k => k.id === id)) { alert('이미 존재하는 ID입니다'); return; }
    if (!customForm.name.trim()) { alert('이름을 입력하세요'); return; }
    setKeys(prev => {
      const next = [...prev, {
        id,
        name: customForm.name.trim(),
        apiKey: customForm.apiKey,
        model: customForm.model,
        enabled: true,
        custom: true,
      }];
      saveAiKeys(next);
      return next;
    });
    setCustomForm({ id: '', name: '', apiKey: '', model: '' });
    setAddMode(null);
  };

  const remove = (id) => {
    if (!confirm('이 프로바이더를 삭제할까요?')) return;
    setKeys(prev => {
      const next = prev.filter(k => k.id !== id);
      saveAiKeys(next);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-800">AI API 키</h3>
          <p className="text-xs text-gray-400 mt-0.5">키 입력 즉시 자동 저장 · 대시보드 전체 AI 기능에 바로 적용</p>
        </div>
        <button
          onClick={() => setAddMode(addMode ? null : 'pick')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14"/><path d="M12 5v14"/>
          </svg>
          프로바이더 추가
        </button>
      </div>

      {/* 추가 패널 */}
      {addMode === 'pick' && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-bold text-indigo-700">프로바이더 선택</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {availablePresets.map(p => (
              <button
                key={p.id}
                onClick={() => addPreset(p)}
                className="flex items-center gap-2.5 px-3 py-2.5 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-all text-left"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                  style={{ background: p.color }}>
                  {p.icon}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-800">{p.name}</p>
                  <p className="text-[10px] text-gray-400">{p.desc}</p>
                </div>
              </button>
            ))}
            <button
              onClick={() => setAddMode('custom')}
              className="flex items-center gap-2.5 px-3 py-2.5 bg-white border border-dashed border-gray-300 rounded-xl hover:border-indigo-300 transition-all"
            >
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-lg flex-shrink-0">+</div>
              <div>
                <p className="text-xs font-semibold text-gray-600">직접 입력</p>
                <p className="text-[10px] text-gray-400">커스텀 프로바이더</p>
              </div>
            </button>
          </div>
          {availablePresets.length === 0 && (
            <p className="text-xs text-indigo-500">모든 프리셋 프로바이더가 이미 추가되었습니다.</p>
          )}
          <button onClick={() => setAddMode(null)} className="text-xs text-gray-400 hover:text-gray-600">취소</button>
        </div>
      )}

      {addMode === 'custom' && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-bold text-gray-700">커스텀 프로바이더 추가</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="이름 *" value={customForm.name} onChange={v => setCustomForm(p => ({ ...p, name: v }))} placeholder="예: Mistral" />
            <Field label="ID (영문, 선택)" value={customForm.id} onChange={v => setCustomForm(p => ({ ...p, id: v }))} placeholder="예: mistral" mono />
            <Field label="API 키" type="password" value={customForm.apiKey} onChange={v => setCustomForm(p => ({ ...p, apiKey: v }))} placeholder="API 키 입력" mono />
            <Field label="기본 모델" value={customForm.model} onChange={v => setCustomForm(p => ({ ...p, model: v }))} placeholder="예: mistral-large-latest" mono />
          </div>
          <div className="flex gap-2">
            <button onClick={addCustom} className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700">추가</button>
            <button onClick={() => setAddMode(null)} className="px-4 py-2 border border-gray-200 text-gray-500 text-xs rounded-lg hover:bg-gray-50">취소</button>
          </div>
        </div>
      )}

      {/* 등록된 프로바이더 카드 목록 */}
      {keys.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <span className="text-3xl mb-3">🤖</span>
          <p className="text-sm text-gray-500 font-medium">아직 등록된 AI 프로바이더가 없습니다</p>
          <p className="text-xs text-gray-400 mt-1">위의 '프로바이더 추가' 버튼을 눌러 시작하세요</p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map(entry => {
            const preset = PRESET_PROVIDERS.find(p => p.id === entry.id);
            const color = preset?.color || '#6B7280';
            const bgColor = preset?.bgColor || '#F9FAFB';
            const icon = preset?.icon || entry.name?.charAt(0) || '?';
            const models = preset?.models || [];
            const keyHint = preset?.keyHint || '';
            const isVisible = showKey[entry.id];

            return (
              <div key={entry.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                {/* 카드 헤더 */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100"
                  style={{ background: `linear-gradient(to right, ${bgColor}, #fff)` }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                    style={{ background: color }}>
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-gray-800">{entry.name}</p>
                      {entry.custom && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">커스텀</span>
                      )}
                    </div>
                    {preset && <p className="text-[11px] text-gray-400">{preset.desc}</p>}
                  </div>
                  {/* 활성 뱃지 */}
                  {entry.apiKey && entry.enabled ? (
                    <span className="text-[10px] font-bold bg-green-100 text-green-600 border border-green-200 rounded-full px-2.5 py-1">✓ 활성</span>
                  ) : (
                    <span className="text-[10px] font-bold bg-gray-100 text-gray-400 border border-gray-200 rounded-full px-2.5 py-1">미설정</span>
                  )}
                  {/* 활성화 토글 */}
                  <label className="flex items-center gap-1.5 cursor-pointer ml-1">
                    <span className="text-[10px] text-gray-400">활성화</span>
                    <div className="relative"
                      onClick={() => update(entry.id, 'enabled', !entry.enabled)}>
                      <div className="w-9 h-5 rounded-full transition-colors"
                        style={{ background: entry.enabled ? color : '#D1D5DB' }}>
                        <div className="w-4 h-4 bg-white rounded-full absolute top-0.5 shadow transition-transform"
                          style={{ left: entry.enabled ? '18px' : '2px' }} />
                      </div>
                    </div>
                  </label>
                  {/* 삭제 */}
                  <button onClick={() => remove(entry.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                    </svg>
                  </button>
                </div>

                {/* 카드 바디 */}
                <div className="p-5 space-y-3">
                  {/* API 키 입력 */}
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">API 키</label>
                    <div className="flex gap-2">
                      <input
                        type={isVisible ? 'text' : 'password'}
                        value={entry.apiKey || ''}
                        onChange={e => update(entry.id, 'apiKey', e.target.value)}
                        placeholder={preset?.keyPlaceholder || 'API 키 입력'}
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-indigo-400 bg-white transition-colors font-mono"
                      />
                      <button
                        onClick={() => setShowKey(prev => ({ ...prev, [entry.id]: !isVisible }))}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 text-xs transition-all flex-shrink-0"
                      >
                        {isVisible ? '숨기기' : '보기'}
                      </button>
                    </div>
                    {keyHint && <p className="text-[11px] text-gray-400 mt-1">📎 {keyHint}</p>}
                  </div>

                  {/* 모델 선택 */}
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">모델</label>
                    {models.length > 0 ? (
                      <select
                        value={entry.model || preset?.defaultModel || ''}
                        onChange={e => update(entry.id, 'model', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-indigo-400 bg-white font-mono"
                      >
                        {models.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    ) : (
                      <input
                        value={entry.model || ''}
                        onChange={e => update(entry.id, 'model', e.target.value)}
                        placeholder="모델명 입력"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-indigo-400 bg-white font-mono"
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-gray-400">
        🔒 API 키는 브라우저 로컬스토리지에 저장됩니다. 입력 즉시 자동 저장되며 새로고침 후에도 유지됩니다.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════
// 탭 3: 쿠팡 API 설정
// ═══════════════════════════════════════════
function CoupangTab() {
  const [creds, setCreds] = useState(() => loadCoupangCreds());
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const set = (k, v) => setCreds(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    saveCoupangCreds(creds);
    setSaved(true);
    setTestResult(null);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    if (!creds.accessKey || !creds.secretKey || !creds.vendorId) {
      setTestResult({ ok: false, msg: 'Access Key, Secret Key, Vendor ID를 모두 입력하세요.' });
      return;
    }
    setTesting(true);
    setTestResult(null);

    // Vercel 함수 → DigitalOcean 고정IP → 쿠팡 API
    try {
      const resp = await fetch('/api/coupang-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessKey: creds.accessKey,
          secretKey: creds.secretKey,
          vendorId:  creds.vendorId,
          endpoint:  'connect',
        }),
      });
      const json = await resp.json();
      if (resp.ok) {
        setTestResult({ ok: true, msg: json.message || '연결 성공!' });
      } else {
        const msg = json?.error || json?.detail || `HTTP ${resp.status}`;
        setTestResult({ ok: false, msg: `❌ ${msg}` });
      }
    } catch (e) {
      setTestResult({ ok: false, msg: `❌ 연결 실패: ${e.message}` });
    }
    setTesting(false);
  };

  const connected = !!(creds.accessKey && creds.secretKey && creds.vendorId);

  return (
    <div className="space-y-5">
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100"
          style={{ background: 'linear-gradient(to right, #fff7ed, #fff)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-lg font-bold"
            style={{ background: '#f97316' }}>C</div>
          <div>
            <p className="text-sm font-bold text-gray-800">쿠팡 Wing Open API</p>
            <p className="text-xs text-gray-400">GrowthDB 실시간 상품 데이터 연동</p>
          </div>
          {connected && (
            <span className="ml-auto text-[10px] font-bold bg-green-100 text-green-600
              border border-green-200 rounded-full px-2.5 py-1">✓ 설정됨</span>
          )}
        </div>

        {/* 입력 폼 */}
        <div className="p-5 space-y-4">
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-700 leading-relaxed">
            <strong>발급 경로:</strong> 쿠팡 Wing → 설정 → 개발자 오픈 API →
            <a href="https://wing.coupang.com" target="_blank" rel="noreferrer"
              className="underline ml-1">wing.coupang.com</a>
          </div>

          <Field label="Access Key" value={creds.accessKey || ''} onChange={v => set('accessKey', v)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" mono />
          <Field label="Secret Key" type="password" value={creds.secretKey || ''} onChange={v => set('secretKey', v)}
            placeholder="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" mono />
          <Field label="Vendor ID (판매자 ID)" value={creds.vendorId || ''} onChange={v => set('vendorId', v)}
            placeholder="A00000000" mono />

          {/* 결과 */}
          {testResult && (
            <div className={`p-3 rounded-xl text-xs font-medium ${
              testResult.ok ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-red-50 text-red-600 border border-red-200'}`}>
              {testResult.ok ? '✅ ' : '❌ '}{testResult.msg}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <button onClick={handleTest} disabled={testing}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg border
                border-orange-300 text-orange-600 hover:bg-orange-50 disabled:opacity-50 transition-all">
              {testing ? (
                <svg className="animate-spin w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
              ) : '🔌'}
              연결 테스트
            </button>
            <button onClick={handleSave}
              className={`px-5 py-2 text-xs font-bold rounded-lg transition-all text-white ${
                saved ? 'bg-green-500' : 'bg-orange-500 hover:bg-orange-600'}`}>
              {saved ? '✓ 저장됨' : '저장'}
            </button>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-gray-400">
        🔒 API 키는 브라우저 로컬스토리지에 저장됩니다. Secret Key는 서버에서만 사용됩니다.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════
// 탭: 구글 회원 DB
// ═══════════════════════════════════════════
function MembersTab() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [actionId, setActionId] = useState(null);

  const fetchMembers = () => {
    setLoading(true);
    setError(null);
    fetch("/api/users-db")
      .then(r => r.json())
      .then(d => { setMembers(d.users || []); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  };

  useEffect(() => { fetchMembers(); }, []);

  const setRole = async (userId, role) => {
    setActionId(userId);
    await fetch("/api/users-db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setRole", userId, role }),
    });
    await fetchMembers();
    setActionId(null);
  };

  const deleteMember = async (userId) => {
    if (!confirm("이 회원을 삭제할까요?")) return;
    setActionId(userId);
    await fetch("/api/users-db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", userId }),
    });
    await fetchMembers();
    setActionId(null);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-gray-400 text-sm">불러오는 중...</div>
  );
  if (error) return (
    <div className="py-10 text-center text-red-500 text-sm">{error}</div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Google 회원 DB</h3>
          <p className="text-xs text-gray-400 mt-0.5">Google 로그인으로 가입된 사용자 · 총 {members.length}명</p>
        </div>
        <button
          onClick={fetchMembers}
          className="px-3 py-1.5 text-xs font-semibold border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-all"
        >
          새로고침
        </button>
      </div>

      {members.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <span className="text-3xl mb-3">👤</span>
          <p className="text-sm text-gray-500 font-medium">아직 Google로 가입한 회원이 없습니다</p>
          <p className="text-xs text-gray-400 mt-1">로그인 모달에서 "Google로 계속하기"를 통해 가입됩니다</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["", "이름 / 이메일", "가입일", "최근 로그인", "역할", ""].map((h, i) => (
                  <th key={i} className="text-left px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {members.map(m => (
                <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 w-10">
                    {m.picture
                      ? <img src={m.picture} alt="" className="w-8 h-8 rounded-full object-cover" />
                      : <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">
                          {m.displayName?.charAt(0) || "?"}
                        </div>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-800 text-sm">{m.displayName}</p>
                    <p className="text-xs text-gray-400">{m.email}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {new Date(m.createdAt).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleDateString("ko-KR") : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={m.role || "user"}
                      disabled={actionId === m.id}
                      onChange={e => setRole(m.id, e.target.value)}
                      className="px-2 py-1 text-xs border border-gray-200 rounded-lg outline-none focus:border-purple-400 bg-white"
                    >
                      <option value="user">일반</option>
                      <option value="member">멤버</option>
                      <option value="admin">관리자</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => deleteMember(m.id)}
                      disabled={actionId === m.id}
                      className="px-2.5 py-1 text-[11px] font-semibold border border-gray-200 text-red-400 rounded-lg hover:border-red-200 hover:bg-red-50 disabled:opacity-40 transition-all"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-gray-400">
        Google OAuth 2.0 인증을 통해 가입된 회원입니다. 역할은 저장 즉시 반영됩니다.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════
// 메인 AdminPage
// ═══════════════════════════════════════════
const ADMIN_TABS = [
  { key: "users",   label: "사용자 관리" },
  { key: "social",  label: "소셜 계정 연동" },
  { key: "members", label: "👥 회원 DB" },
  { key: "stats",   label: "프로젝트 통계" },
  { key: "coupang", label: "🛒 쿠팡 API" },
  { key: "aikeys",  label: "🤖 AI API 키" },
];

function relativeTime(iso) {
  if (!iso) return "-";
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return "오늘";
  if (d === 1) return "어제";
  if (d < 7) return `${d}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

export default function AdminPage({ projects = [], trash = [], onLoad }) {
  const [activeTab, setActiveTab] = useState("users");

  return (
    <div className="flex-1 overflow-y-auto px-6 sm:px-10 py-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">

        {/* 헤더 */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-800">관리자</h2>
          <p className="text-sm text-gray-400 mt-0.5">사용자 · 소셜 계정 · 프로젝트 통계</p>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-xl p-1 w-fit">
          {ADMIN_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab === tab.key
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        {activeTab === "users"   && <UsersTab />}
        {activeTab === "social"  && <SocialTab />}
        {activeTab === "members" && <MembersTab />}
        {activeTab === "coupang" && <CoupangTab />}
        {activeTab === "aikeys"  && <AiApiTab />}

        {activeTab === "stats" && (
          <div className="space-y-6">
            {/* 통계 카드 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "전체 프로젝트", value: projects.length, icon: "📋" },
                { label: "기능명세서 생성", value: projects.filter((p) => p.specData).length, icon: "📄" },
                { label: "유저플로우 생성", value: projects.filter((p) => p.flowData).length, icon: "🔀" },
                { label: "휴지통", value: trash.length, icon: "🗑️" },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-2xl p-5 border border-gray-200">
                  <div className="text-2xl mb-2">{s.icon}</div>
                  <div className="text-2xl font-bold text-gray-800">{s.value}</div>
                  <div className="text-xs text-gray-400 mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {/* 프로젝트 목록 */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">프로젝트 목록</h3>
              </div>
              {projects.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">프로젝트가 없습니다.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {["프로젝트명", "한 줄 설명", "기능명세서", "유저플로우", "마지막 수정"].map((h) => (
                        <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {projects.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => onLoad && onLoad(p)}>
                        <td className="px-6 py-3.5 font-medium text-gray-800 max-w-[180px] truncate">{p.title}</td>
                        <td className="px-6 py-3.5 text-gray-500 max-w-[220px] truncate">{p.prd?.overview?.one_liner || "-"}</td>
                        <td className="px-6 py-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.specData ? "bg-purple-50 text-purple-600" : "bg-gray-100 text-gray-400"}`}>
                            {p.specData ? "완료" : "미생성"}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.flowData ? "bg-indigo-50 text-indigo-600" : "bg-gray-100 text-gray-400"}`}>
                            {p.flowData ? "완료" : "미생성"}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-gray-400">{relativeTime(p.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
