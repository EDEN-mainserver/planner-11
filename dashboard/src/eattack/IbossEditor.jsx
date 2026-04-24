import { useState } from "react";

const CRED_KEY = "iboss_credentials";

function loadCreds() {
  try { return JSON.parse(localStorage.getItem(CRED_KEY) || "null"); }
  catch { return null; }
}
function saveCreds(creds) {
  localStorage.setItem(CRED_KEY, JSON.stringify(creds));
}

// ─── 자동 포스팅 모달 ───
function PostingModal({ onConfirm, onClose, isPosting, postResult }) {
  const saved = loadCreds();
  const [id, setId] = useState(saved?.id || "");
  const [pw, setPw] = useState(saved?.pw || "");
  const [rememberMe, setRememberMe] = useState(!!saved);

  const handleSubmit = () => {
    if (!id.trim() || !pw.trim()) return;
    if (rememberMe) saveCreds({ id, pw });
    else localStorage.removeItem(CRED_KEY);
    onConfirm({ id, pw });
  };

  if (postResult) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
          {postResult.success ? (
            <>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-gray-900">등록 완료!</p>
                  <p className="text-xs text-gray-400">아이보스에 글이 올라갔습니다</p>
                </div>
              </div>
              {postResult.postUrl && (
                <a
                  href={postResult.postUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-medium hover:bg-emerald-100 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/>
                  </svg>
                  등록된 글 보기
                </a>
              )}
              <button onClick={onClose} className="w-full h-10 text-sm font-medium rounded-xl bg-gray-900 text-white hover:bg-gray-800 transition-colors">
                닫기
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
                    <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-gray-900">등록 실패</p>
                  <p className="text-xs text-red-500">{postResult.error}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={onClose} className="flex-1 h-10 text-sm font-medium rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                  닫기
                </button>
                <button onClick={() => onConfirm({ id, pw })} className="flex-1 h-10 text-sm font-medium rounded-xl bg-gray-900 text-white hover:bg-gray-800 transition-colors">
                  다시 시도
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-5">
        <div>
          <h3 className="text-lg font-bold text-gray-900">아이보스 자동 포스팅</h3>
          <p className="text-xs text-gray-400 mt-0.5">i-boss.co.kr 계정으로 직접 등록합니다</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">아이디</label>
            <input
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="아이보스 아이디"
              autoComplete="username"
              className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 transition-all"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">비밀번호</label>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="비밀번호"
              autoComplete="current-password"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 transition-all"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-xs text-gray-500">이 기기에 로그인 정보 저장</span>
          </label>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
          <p className="text-xs text-amber-700">
            비밀번호는 브라우저 로컬스토리지에만 저장되며 외부로 전송되지 않습니다.
          </p>
        </div>

        {isPosting ? (
          <div className="flex items-center justify-center gap-2 h-12 rounded-xl bg-emerald-600 text-white">
            <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <span className="text-sm font-medium">포스팅 중...</span>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 h-10 text-sm font-medium rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={!id.trim() || !pw.trim()}
              className={`flex-1 h-10 text-sm font-semibold rounded-xl transition-colors ${
                id.trim() && pw.trim()
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              포스팅 시작
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 메인 에디터 ───
export default function IbossEditor({ post, onBack, onSave, onDone }) {
  const [title, setTitle] = useState(post.title || "");
  const [content, setContent] = useState(post.content || "");
  const [editMode, setEditMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedStatus, setSavedStatus] = useState("");
  const [showPostModal, setShowPostModal] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [postResult, setPostResult] = useState(null);

  // 현재 글자 수
  const charCount = content.length;

  // 제목 교체
  const handleAltTitle = (t) => setTitle(t);

  // 복사
  const handleCopy = () => {
    navigator.clipboard.writeText(`${title}\n\n${content}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // 저장
  const handleSave = (status) => {
    onSave({ ...post, title, content, status, updatedAt: new Date().toISOString() });
    setSavedStatus(status);
    if (status === "done") setTimeout(() => onDone?.(), 1200);
  };

  // 자동 포스팅
  const handlePost = async ({ id, pw }) => {
    setIsPosting(true);
    setPostResult(null);
    try {
      const resp = await fetch("/api/iboss-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, pw, title, content }),
      });
      const data = await resp.json();
      setPostResult(data);
      if (data.success) {
        handleSave("done");
      }
    } catch (e) {
      setPostResult({ success: false, error: e.message });
    } finally {
      setIsPosting(false);
    }
  };

  const POST_TYPE_LABELS = {
    info: "정보공유형",
    case: "사례형",
    insight: "인사이트형",
    question: "질문형",
  };

  const POST_TYPE_COLORS = {
    info: "bg-blue-50 text-blue-700",
    case: "bg-emerald-50 text-emerald-700",
    insight: "bg-violet-50 text-violet-700",
    question: "bg-orange-50 text-orange-700",
  };

  return (
    <div className="flex-1 overflow-y-auto bg-white h-full flex flex-col">
      {/* 헤더 */}
      <header className="px-4 sm:px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
            </button>
            <div className="min-w-0">
              <p className="text-xs text-gray-400 font-medium">아이보스 · {POST_TYPE_LABELS[post.postType] || "글"}</p>
              <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate">생성된 글</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setEditMode(!editMode)}
              className={`h-8 px-3 text-xs font-medium rounded-lg border transition-all ${
                editMode
                  ? "bg-gray-900 text-white border-gray-900"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              {editMode ? "편집 중" : "편집"}
            </button>
            <button
              onClick={handleCopy}
              className={`h-8 px-3 text-xs font-medium rounded-lg border transition-all ${
                copied
                  ? "bg-green-50 text-green-600 border-green-200"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              {copied ? "복사됨!" : "복사"}
            </button>
            <button
              onClick={() => { setPostResult(null); setShowPostModal(true); }}
              className="h-8 px-3 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
              </svg>
              포스팅
            </button>
          </div>
        </div>
      </header>

      {/* 저장 피드백 */}
      {savedStatus && (
        <div className={`px-4 sm:px-6 py-2.5 flex items-center gap-2 text-sm font-medium ${
          savedStatus === "done"
            ? "bg-green-50 text-green-700 border-b border-green-100"
            : "bg-blue-50 text-blue-700 border-b border-blue-100"
        }`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          {savedStatus === "done" ? "완료로 저장됐습니다." : "초안으로 저장됐습니다."}
        </div>
      )}

      <div className="max-w-3xl mx-auto w-full px-4 sm:px-8 py-6 sm:py-8 space-y-5 flex-1">
        {/* 유형 뱃지 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${POST_TYPE_COLORS[post.postType] || "bg-gray-100 text-gray-600"}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current"/>
            {POST_TYPE_LABELS[post.postType] || "글"}
          </span>
          <span className="text-xs text-gray-400">{charCount.toLocaleString()}자</span>
        </div>

        {/* 제목 */}
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">제목</p>
          {editMode ? (
            <textarea
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              rows={2}
              className="w-full text-xl sm:text-2xl font-bold text-gray-900 border-b-2 border-emerald-300 focus:outline-none focus:border-emerald-500 resize-none bg-transparent leading-snug"
            />
          ) : (
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug">{title}</h2>
          )}

          {/* 대체 제목 제안 */}
          {post.altTitles?.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <p className="text-[11px] text-gray-400 font-medium">다른 제목 후보:</p>
              {post.altTitles.map((t, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleAltTitle(t)}
                  className="block w-full text-left px-3 py-2 rounded-lg border border-dashed border-gray-200 text-sm text-gray-500 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/50 transition-all"
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>

        <hr className="border-gray-100"/>

        {/* 본문 */}
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">본문</p>
          {editMode ? (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full text-sm sm:text-base text-gray-700 leading-relaxed border border-gray-200 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-emerald-200 resize-none bg-gray-50/50 min-h-[400px]"
              style={{ height: `${Math.max(400, content.split("\n").length * 24 + 60)}px` }}
            />
          ) : (
            <div className="text-sm sm:text-base text-gray-700 leading-relaxed whitespace-pre-wrap">
              {content}
            </div>
          )}
        </div>
      </div>

      {/* 하단 액션 바 */}
      <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <button
          onClick={() => handleSave("draft")}
          className="h-9 px-4 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          초안으로 저장
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className={`h-9 px-4 text-sm font-medium rounded-lg border transition-all ${
              copied
                ? "bg-green-50 text-green-600 border-green-200"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {copied ? "복사됨!" : "전체 복사"}
          </button>
          <button
            onClick={() => { setPostResult(null); setShowPostModal(true); }}
            className="h-9 px-4 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
            </svg>
            아이보스 포스팅
          </button>
        </div>
      </div>

      {/* 포스팅 모달 */}
      {showPostModal && (
        <PostingModal
          onConfirm={handlePost}
          onClose={() => { setShowPostModal(false); setPostResult(null); }}
          isPosting={isPosting}
          postResult={postResult}
        />
      )}
    </div>
  );
}
