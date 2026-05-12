import { useState } from "react";
import Field from "./Field";
import { loadUsers, saveUsers } from "../../services/admin/users";

export default function UsersTab() {
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
