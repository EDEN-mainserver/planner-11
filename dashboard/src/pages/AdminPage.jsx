// 관리자 페이지
// - 사용자 관리 (추가/수정/삭제)
// - 소셜 계정 API 연동 (인스타그램 · 스레드 per user)
// - AI API 키 관리 (Gemini, Claude, OpenAI 등)
import { useState } from "react";
import UsersTab from "./admin/UsersTab";
import SocialTab from "./admin/SocialTab";
import AiApiTab from "./admin/AiApiTab";
import CoupangTab from "./admin/CoupangTab";
import MembersTab from "./admin/MembersTab";
// ═══════════════════════════════════════════
// 탭 2: 소셜 계정 API 연동
// ═══════════════════════════════════════════
// 탭 3: AI API 키 관리
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
