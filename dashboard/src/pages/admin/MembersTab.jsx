import { useState, useEffect } from "react";

export default function MembersTab() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [actionId, setActionId] = useState(null);
  const [savedId, setSavedId] = useState(null);

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
    const prev = members;
    setMembers(ms => ms.map(m => m.id === userId ? { ...m, role } : m));
    setActionId(userId);
    try {
      const res = await fetch("/api/users-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setRole", userId, role }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `저장 실패 (HTTP ${res.status})`);
      }
      setSavedId(userId);
      setTimeout(() => setSavedId(null), 1500);
    } catch (e) {
      setMembers(prev);
      alert(`역할 저장 실패: ${e.message}`);
    } finally {
      setActionId(null);
    }
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
                    <div className="flex items-center gap-2">
                      <div className="inline-flex border border-gray-200 rounded-lg overflow-hidden">
                        {[
                          { value: "user",   label: "일반",   active: "bg-gray-100 text-gray-700" },
                          { value: "member", label: "멤버",   active: "bg-blue-50 text-blue-600" },
                          { value: "admin",  label: "관리자", active: "bg-purple-50 text-purple-600" },
                        ].map(opt => {
                          const current = (m.role || "user") === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              disabled={actionId === m.id}
                              onClick={() => { if (!current) setRole(m.id, opt.value); }}
                              className={`px-2.5 py-1 text-[11px] font-semibold transition-all border-r border-gray-200 last:border-r-0 disabled:opacity-50 ${
                                current ? `${opt.active} font-bold` : "bg-white text-gray-400 hover:bg-gray-50"
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                      {actionId === m.id && (
                        <span className="text-[11px] text-gray-400">저장중...</span>
                      )}
                      {savedId === m.id && (
                        <span className="text-[11px] text-green-500 font-semibold">✓ 저장됨</span>
                      )}
                    </div>
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
