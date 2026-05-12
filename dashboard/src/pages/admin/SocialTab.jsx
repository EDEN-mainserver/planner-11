import { useState } from "react";
import Field from "./Field";
import { igKey, threadsKey, fullAutoKey, API_BASE } from "./constants";
import { loadUsers, saveUsers } from "../../services/admin/users";
import { loadSocial, saveSocial } from "../../services/pipeline/socialStorage";
import { loadFullAuto, saveFullAutoSettings } from "../../services/admin/fullAuto";

export default function SocialTab() {
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
  const [igFetching, setIgFetching] = useState(false);
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

  const fetchIgAccountId = async () => {
    const accessToken = String(ig.accessToken || "").trim();
    if (!accessToken) { addLog("error", "Instagram 액세스 토큰을 먼저 입력하세요"); return; }
    if (igFetching) return;
    setIgFetching(true);
    addLog("info", "Facebook 페이지 → Instagram 계정 ID 조회 중...");
    try {
      const pagesRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?access_token=${accessToken}`
      );
      const pagesData = await pagesRes.json();
      if (pagesData.error) throw new Error(pagesData.error.message);
      if (!pagesData.data?.length) {
        throw new Error("연결된 Facebook 페이지가 없습니다. Facebook 페이지와 Instagram 비즈니스 계정을 연결해주세요.");
      }

      let foundId = null;
      let foundUsername = null;
      for (const page of pagesData.data) {
        const igRes = await fetch(
          `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account&access_token=${accessToken}`
        );
        const igData = await igRes.json();
        if (igData.error) throw new Error(igData.error.message);
        if (igData.instagram_business_account?.id) {
          foundId = igData.instagram_business_account.id;
          const uRes = await fetch(
            `https://graph.facebook.com/v21.0/${foundId}?fields=username&access_token=${accessToken}`
          );
          const uData = await uRes.json();
          if (uData.error) throw new Error(uData.error.message);
          foundUsername = uData.username || foundId;
          break;
        }
      }

      if (!foundId) {
        throw new Error("Facebook 페이지에 연결된 Instagram 비즈니스 계정을 찾을 수 없습니다.");
      }

      const next = { ...ig, accountId: foundId, accessToken };
      setIg(next);
      saveSocial(igKey, selectedUser, next);
      const res = await fetch("/api/social-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: selectedUser,
          instagram: {
            accountId: String(foundId || "").trim(),
            accessToken: String(accessToken || "").trim(),
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "서버 저장 실패");
      setIgSaved(true);
      setTimeout(() => setIgSaved(false), 2000);
      addLog("info", `✅ 조회 성공: @${foundUsername} → ${foundId}`);
      addLog("info", `Instagram 설정 자동 저장됨 (${selectedUser})`);
    } catch (e) {
      addLog("error", `계정 ID 조회 실패: ${e.message}`);
    } finally {
      setIgFetching(false);
    }
  };

  const saveIg = async () => {
    saveSocial(igKey, selectedUser, ig);
    try {
      const res = await fetch("/api/social-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: selectedUser,
          instagram: {
            accountId: String(ig.accountId || "").trim(),
            accessToken: String(ig.accessToken || "").trim(),
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "서버 저장 실패");
      setIgSaved(true);
      setTimeout(() => setIgSaved(false), 2000);
      addLog("info", `Instagram 설정 저장됨 (${selectedUser})`);
    } catch (e) {
      addLog("error", `Instagram 서버 저장 실패: ${e.message}`);
    }
  };

  const saveTh = async () => {
    saveSocial(threadsKey, selectedUser, th);
    try {
      const res = await fetch("/api/social-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: selectedUser,
          threads: {
            userId: String(th.userId || "").trim(),
            accessToken: String(th.accessToken || "").trim(),
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "서버 저장 실패");
      setThSaved(true);
      setTimeout(() => setThSaved(false), 2000);
      addLog("info", `Threads 설정 저장됨 (${selectedUser})`);
    } catch (e) {
      addLog("error", `Threads 서버 저장 실패: ${e.message}`);
    }
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
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchIgAccountId}
                    disabled={igFetching || !ig.accessToken?.trim()}
                    className="px-3 py-2 text-xs font-bold border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-all whitespace-nowrap"
                  >
                    {igFetching ? "조회 중..." : "ID 조회"}
                  </button>
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
