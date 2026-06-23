// 제안서 패널
// - 좌측 드롭다운(또는 리스트)으로 결과 선택
// - 우측: 제목 + HTML 미리보기(iframe) + 편집/저장
// - 발송 승인 토글

import { useEffect, useState } from "react";
import { emailAttackApi } from "../api/client";

export default function ProposalsPanel({ jobId, onClose }) {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ subject: "", body_html: "" });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const { proposals } = await emailAttackApi.listProposals(jobId);
      setProposals(proposals);
      if (proposals.length > 0 && !selectedId) {
        setSelectedId(proposals[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const selected = proposals.find((p) => p.id === selectedId);

  // 선택 바뀔 때 편집 모드 초기화
  useEffect(() => {
    setEditing(false);
    if (selected) {
      setDraft({ subject: selected.subject, body_html: selected.body_html });
    }
  }, [selectedId, selected]);

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const { proposal } = await emailAttackApi.updateProposal({
        id: selected.id,
        subject: draft.subject,
        body_html: draft.body_html,
      });
      setProposals((prev) => prev.map((p) => (p.id === proposal.id ? { ...p, ...proposal } : p)));
      setEditing(false);
      setSaveMsg("✓ 저장됨");
      setTimeout(() => setSaveMsg(""), 2000);
    } catch (e) {
      setSaveMsg("실패: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleApproved = async (next) => {
    if (!selected) return;
    try {
      const { proposal } = await emailAttackApi.updateProposal({
        id: selected.id,
        approved: next,
      });
      setProposals((prev) => prev.map((p) => (p.id === proposal.id ? { ...p, ...proposal } : p)));
    } catch (e) {
      alert("저장 실패: " + e.message);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <p className="text-sm text-gray-500">제안서 불러오는 중...</p>
      </div>
    );
  }

  if (proposals.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <p className="text-sm text-gray-500">아직 생성된 제안서가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-br from-amber-50 to-orange-50">
        <h3 className="text-sm font-semibold text-gray-900">
          ✉️ 제안서 ({proposals.length}건)
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-xs text-gray-500 hover:text-gray-900"
          >
            ✕ 닫기
          </button>
        )}
      </div>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* 좌측: 드롭다운 + 리스트 */}
        <div className="space-y-2">
          <select
            value={selectedId || ""}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            {proposals.map((p) => (
              <option key={p.id} value={p.id}>
                {(p.result?.brand_name || p.result?.domain || "?")}
                {p.approved ? " ✓" : ""}
              </option>
            ))}
          </select>

          <ul className="border border-gray-200 rounded-lg divide-y max-h-[480px] overflow-y-auto">
            {proposals.map((p) => {
              const isSel = p.id === selectedId;
              const name = p.result?.brand_name || p.result?.domain || "?";
              return (
                <li key={p.id}>
                  <button
                    onClick={() => setSelectedId(p.id)}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                      isSel ? "bg-orange-50 text-orange-900" : "hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <div className="font-medium truncate flex items-center gap-1">
                      {p.approved && <span className="text-green-600">✓</span>}
                      {name}
                    </div>
                    <div className="text-[10px] text-gray-400 truncate">
                      {p.recipient_email}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* 우측: 미리보기 / 편집 */}
        <div className="space-y-3">
          {!selected ? (
            <p className="text-sm text-gray-400 text-center py-12">제안서를 선택하세요</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                  <span>→ <strong className="text-gray-900">{selected.recipient_email}</strong></span>
                  <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] uppercase tracking-wide">
                    {selected.language}
                  </span>
                  <span className="px-1.5 py-0.5 bg-orange-50 text-orange-700 rounded text-[10px]">
                    {selected.model}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!selected.approved}
                      onChange={(e) => handleToggleApproved(e.target.checked)}
                    />
                    <span>발송 승인</span>
                  </label>
                  {!editing ? (
                    <button
                      onClick={() => setEditing(true)}
                      className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      편집
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setDraft({ subject: selected.subject, body_html: selected.body_html });
                          setEditing(false);
                        }}
                        className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        취소
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="text-xs px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
                      >
                        {saving ? "저장..." : "저장"}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {saveMsg && (
                <p className={`text-xs ${saveMsg.startsWith("✓") ? "text-green-600" : "text-red-600"}`}>
                  {saveMsg}
                </p>
              )}

              {/* 제목 */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">제목</label>
                {editing ? (
                  <input
                    type="text"
                    value={draft.subject}
                    onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                ) : (
                  <p className="px-3 py-2 bg-gray-50 rounded-lg text-sm">{selected.subject}</p>
                )}
              </div>

              {/* 본문 */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                  본문 ({editing ? "HTML 직접 편집" : "미리보기"})
                </label>
                {editing ? (
                  <textarea
                    value={draft.body_html}
                    onChange={(e) => setDraft({ ...draft, body_html: e.target.value })}
                    rows={16}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                ) : (
                  <iframe
                    title="proposal preview"
                    srcDoc={`<style>body{font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;padding:16px;color:#1f2937;line-height:1.6;font-size:14px}p{margin:0 0 12px 0}</style>${selected.body_html}`}
                    className="w-full h-[440px] border border-gray-200 rounded-lg bg-white"
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
