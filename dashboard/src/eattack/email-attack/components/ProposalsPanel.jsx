// 제안서 패널
// - 좌측 드롭다운(또는 리스트)으로 결과 선택
// - 우측: 제목 + HTML 미리보기(iframe) + 편집/저장
// - 발송 승인 토글

import { useEffect, useState } from "react";
import { emailAttackApi } from "../api/client";

const TEST_TO_EMAIL = "EDEN@teamedenmarketing.com";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHookSubject(proposal) {
  const raw = String(proposal?.subject || "").trim();
  const brand = String(proposal?.result?.brand_name || proposal?.result?.domain || "").split("|")[0].trim();
  const generic = !raw || /제안서|자동 생성|B2B 영업|협업 제안/i.test(raw);
  const fallback = brand
    ? `${brand}, 지금 놓치면 고객을 빼앗깁니다`
    : "지금 놓치면 고객을 빼앗깁니다";
  const subject = generic ? fallback : raw;
  return subject.length > 48 ? `${subject.slice(0, 47)}…` : subject;
}

function buildPreviewDoc(proposal) {
  const brand = proposal.result?.brand_name || proposal.result?.domain || "제안 대상";
  const subject = buildHookSubject(proposal);
  const email = proposal.recipient_email || "";
  const model = proposal.model || "";
  const body = proposal.body_html || "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 24px;
        background: #0f172a;
        color: #1f2937;
        font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", "Segoe UI", sans-serif;
        font-size: 14px;
        line-height: 1.7;
      }
      .email {
        width: min(100%, 720px);
        margin: 0 auto;
        overflow: hidden;
        border: 1px solid #243044;
        border-radius: 18px;
        background: #ffffff;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.32);
      }
      .topbar {
        height: 10px;
        background: #ff6b00;
      }
      .header {
        padding: 30px 30px 24px;
        background: #111827;
        border-bottom: 1px solid #243044;
      }
      .eyebrow {
        margin: 0 0 10px;
        color: #ffb86b;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0;
        color: #ffffff;
        font-size: 27px;
        line-height: 1.25;
        letter-spacing: 0;
        font-weight: 900;
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 16px;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        min-height: 24px;
        padding: 4px 9px;
        border-radius: 999px;
        background: #1f2937;
        color: #cbd5e1;
        font-size: 11px;
        font-weight: 600;
      }
      .pill.dark {
        background: #ff6b00;
        color: #111827;
      }
      .signal {
        margin: 24px 28px 0;
        padding: 16px 18px;
        border: 1px solid #fed7aa;
        border-radius: 12px;
        background: #fff7ed;
        color: #9a3412;
        font-weight: 750;
      }
      .content {
        padding: 24px 30px 30px;
        color: #111827;
        font-size: 15px;
        line-height: 1.85;
      }
      .content p {
        margin: 0 0 16px;
      }
      .content p:first-child {
        font-size: 16px;
        font-weight: 800;
        color: #111827;
      }
      .content h2 {
        margin: 24px 0 10px;
        color: #111827;
        font-size: 16px;
        line-height: 1.4;
      }
      .content ul {
        margin: 0 0 18px;
        padding: 0;
        list-style: none;
      }
      .content li {
        margin: 0 0 8px;
        padding: 10px 12px;
        border-left: 4px solid #ff6b00;
        background: #f8fafc;
        border-radius: 8px;
      }
      .content p:last-child {
        margin-bottom: 0;
      }
      .footer {
        padding: 18px 30px 24px;
        border-top: 1px solid #e5e7eb;
        background: #f8fafc;
        color: #64748b;
        font-size: 12px;
      }
      @media (max-width: 560px) {
        body { padding: 12px; }
        .header, .content, .footer { padding-left: 18px; padding-right: 18px; }
        h1 { font-size: 18px; }
      }
    </style>
  </head>
  <body>
    <article class="email">
      <div class="topbar"></div>
      <header class="header">
        <p class="eyebrow">Proposal Preview</p>
        <h1>${escapeHtml(subject)}</h1>
        <div class="meta">
          <span class="pill dark">${escapeHtml(brand)}</span>
          <span class="pill">${escapeHtml(email)}</span>
          <span class="pill">${escapeHtml(model)}</span>
        </div>
      </header>
      <section class="signal">지금 고객은 긴 설명보다 짧은 확신, 한 번의 노출보다 반복되는 퍼널을 보고 움직입니다.</section>
      <main class="content">${body}</main>
      <footer class="footer">발송 전 검토용 디자인 미리보기입니다.</footer>
    </article>
  </body>
</html>`;
}

export default function ProposalsPanel({ jobId, onClose }) {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ subject: "", body_html: "" });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testMsg, setTestMsg] = useState("");

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
    setTestMsg("");
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

  const handleSendTest = async () => {
    if (!selected || testSending) return;
    setTestSending(true);
    setTestMsg("");
    try {
      const data = await emailAttackApi.sendTestProposal({
        id: selected.id,
        toEmail: TEST_TO_EMAIL,
      });
      setTestMsg(`✓ ${data.to_email || TEST_TO_EMAIL}로 테스트 발송됨`);
    } catch (e) {
      setTestMsg("발송 실패: " + e.message);
    } finally {
      setTestSending(false);
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
                  <button
                    onClick={handleSendTest}
                    disabled={testSending || editing}
                    className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-black disabled:opacity-50"
                    title={`DB 이메일이 아닌 ${TEST_TO_EMAIL}로 테스트 발송합니다.`}
                  >
                    {testSending ? "발송 중..." : "EDEN 테스트 발송"}
                  </button>
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
              {testMsg && (
                <p className={`text-xs ${testMsg.startsWith("✓") ? "text-green-600" : "text-red-600"}`}>
                  {testMsg}
                </p>
              )}

              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                테스트 발송은 DB의 수신자 이메일을 사용하지 않고 {TEST_TO_EMAIL}로만 보냅니다.
                대량 발송 전에는 발송 승인과 발송 로그를 기준으로 단계별로 확장합니다.
              </div>

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
                  본문 ({editing ? "HTML 직접 편집" : "디자인 미리보기"})
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
                    srcDoc={buildPreviewDoc(selected)}
                    className="w-full h-[520px] border border-gray-200 rounded-lg bg-gray-50"
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
