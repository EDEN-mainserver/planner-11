// "내 정보" 입력 모달
// - 발신자 이름, 상호, 서비스 설명
// - ea_settings에서 기존 값 자동 로드 + 변경 시 저장 (다음번에도 유지)

import { useEffect, useState } from "react";
import { emailAttackApi } from "../api/client";

export default function MyInfoModal({ open, onClose, onConfirm, resultCount = 0 }) {
  const [companyName, setCompanyName] = useState("");
  const [senderName, setSenderName] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 모달 열릴 때 ea_settings 로드
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const s = await emailAttackApi.getSettings();
        setCompanyName(s.company_name || s.sender_name || "");
        setSenderName(s.sender_name || "");
        setServiceDescription(s.service_description || "");
      } catch (e) {
        console.warn("[settings load]", e);
      }
    })();
  }, [open]);

  if (!open) return null;

  const handleStart = async () => {
    if (!serviceDescription.trim()) {
      setError("서비스 설명을 입력해주세요 (제안서 핵심 자료)");
      return;
    }
    setError("");
    setLoading(true);
    try {
      // 다음번 사용을 위해 저장
      await Promise.all([
        emailAttackApi.setSetting("company_name", companyName.trim()),
        emailAttackApi.setSetting("sender_name", senderName.trim()),
        emailAttackApi.setSetting("service_description", serviceDescription.trim()),
      ]);
      onConfirm({
        company_name: companyName.trim(),
        sender_name: senderName.trim(),
        service_description: serviceDescription.trim(),
      });
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">제안서 생성 — 내 정보</h2>
          <p className="text-xs text-gray-500 mt-1">
            아래 정보로 발굴된 <strong>{resultCount}개 회사</strong>에 맞춤 제안서를 각각 생성합니다.
            한 번 입력하면 다음에 자동으로 채워집니다.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              상호 / 회사명
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="예: 에덴 마케팅"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              보내는 사람 이름
            </label>
            <input
              type="text"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="예: 정지한 대표"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              서비스 설명 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={serviceDescription}
              onChange={(e) => setServiceDescription(e.target.value)}
              rows={6}
              placeholder="에덴 마케팅이 제공하는 서비스·강점·사례를 자유롭게 적어주세요. 이 내용을 기반으로 각 사이트에 맞는 제안서가 생성됩니다."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 leading-relaxed"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              자세할수록 좋은 제안서가 만들어집니다 (서비스 종류·강점·사례·고객층 등).
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2 bg-gray-50">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded-lg"
          >
            취소
          </button>
          <button
            onClick={handleStart}
            disabled={loading || !serviceDescription.trim()}
            className="px-5 py-2 bg-gradient-to-br from-amber-400 to-orange-500 text-white text-sm font-semibold rounded-lg disabled:opacity-50 hover:shadow-md"
          >
            {loading ? "준비 중..." : `${resultCount}개 제안서 생성 시작`}
          </button>
        </div>
      </div>
    </div>
  );
}
