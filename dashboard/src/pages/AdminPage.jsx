// 관리자 페이지
// - 사용자 관리 (추가/수정/삭제)
// - 소셜 계정 API 연동 (인스타그램 · 스레드 per user)
import { useState } from "react";
import { USERS as SEED_USERS } from "../config/users";

// ── 스토리지 키 ──
const USERS_KEY    = "eden_users_v1";
const igKey        = (u) => `eden_ig_${u}_v1`;
const threadsKey   = (u) => `eden_threads_${u}_v1`;

// ── 사용자 목록 로드 (최초 1회 seed 주입) ──
function loadUsers() {
  try {
    const saved = JSON.parse(localStorage.getItem(USERS_KEY));
    if (saved && saved.length > 0) return saved;
  } catch {}
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
  const users = loadUsers();
  const [selectedUser, setSelectedUser] = useState(users[0]?.username || "");

  // Instagram 상태
  const [ig, setIg] = useState(() => loadSocial(igKey, users[0]?.username || ""));
  // Threads 상태
  const [th, setTh] = useState(() => loadSocial(threadsKey, users[0]?.username || ""));

  const [igSaved, setIgSaved] = useState(false);
  const [thSaved, setThSaved] = useState(false);

  // 사용자 변경 시 해당 사용자의 API 설정 로드
  const handleUserChange = (username) => {
    setSelectedUser(username);
    setIg(loadSocial(igKey, username));
    setTh(loadSocial(threadsKey, username));
    setIgSaved(false);
    setThSaved(false);
  };

  const saveIg = () => {
    saveSocial(igKey, selectedUser, ig);
    setIgSaved(true);
    setTimeout(() => setIgSaved(false), 2000);
  };

  const saveTh = () => {
    saveSocial(threadsKey, selectedUser, th);
    setThSaved(true);
    setTimeout(() => setThSaved(false), 2000);
  };

  const currentUser = users.find((u) => u.username === selectedUser);

  return (
    <div className="space-y-5">
      {/* 사용자 선택 */}
      <div>
        <p className="text-xs font-bold text-gray-600 mb-2">설정할 사용자</p>
        <div className="flex flex-wrap gap-2">
          {users.map((u) => (
            <button
              key={u.username}
              onClick={() => handleUserChange(u.username)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
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
          ))}
        </div>
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
              <Field
                label="Threads 사용자 ID"
                value={th.userId || ""}
                onChange={(v) => setTh((p) => ({ ...p, userId: v }))}
                placeholder="예: 1234567890"
                mono
              />
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

          <p className="text-[11px] text-gray-400">
            🔒 API 키는 사용자별로 브라우저 로컬에 저장됩니다.
          </p>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// 메인 AdminPage
// ═══════════════════════════════════════════
const ADMIN_TABS = [
  { key: "users",  label: "사용자 관리" },
  { key: "social", label: "소셜 계정 연동" },
  { key: "stats",  label: "프로젝트 통계" },
];

export default function AdminPage({ projects = [], trash = [], onLoad }) {
  const [activeTab, setActiveTab] = useState("users");

  const relativeTime = (iso) => {
    if (!iso) return "-";
    const diff = Date.now() - new Date(iso).getTime();
    const d = Math.floor(diff / 86400000);
    if (d === 0) return "오늘";
    if (d === 1) return "어제";
    if (d < 7) return `${d}일 전`;
    return new Date(iso).toLocaleDateString("ko-KR");
  };

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
        {activeTab === "users"  && <UsersTab />}
        {activeTab === "social" && <SocialTab />}

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
