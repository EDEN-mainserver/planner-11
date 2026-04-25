/**
 * 주제 가져오기 패널
 * 소스: 아이보스(확장) / 쓰레드(확장) / X(확장)
 * - 수집 결과는 localStorage에 저장 → 모달 닫아도 유지
 * Props: onSelect(topicString), onClose
 */
import { useState, useEffect, useRef } from "react";
import { POPULAR_SCRIPTS } from "./community/constants";

// ── 로컬스토리지 키 ──
const LS_IBOSS   = "eden_tp_iboss_v1";
const LS_THREADS = "eden_tp_threads_v1";
const LS_X       = "eden_tp_x_v1";

function loadCache(key) {
  try { return JSON.parse(localStorage.getItem(key)) || null; } catch { return null; }
}
function saveCache(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ ...data, savedAt: Date.now() })); } catch {}
}

function timeAgo(ts) {
  if (!ts) return "";
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

const MONTHS = [
  { value: "202508", label: "25년 08월" }, { value: "202509", label: "25년 09월" },
  { value: "202510", label: "25년 10월" }, { value: "202511", label: "25년 11월" },
  { value: "202512", label: "25년 12월" }, { value: "202601", label: "26년 01월" },
  { value: "202602", label: "26년 02월" }, { value: "202603", label: "26년 03월" },
  { value: "202604", label: "26년 04월" },
];

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ── AI 커뮤니티 썰 변환 ──
async function convertToScript(rawText) {
  const systemPrompt = `당신은 커뮤니티 게시판(디씨인사이드, 에펨코리아 등) 스타일의 썰 작가입니다.
주어진 SNS 게시물을 바탕으로 커뮤니티 스타일 썰 스크립트를 작성해주세요.

규칙:
- 제목: 클릭을 유도하는 커뮤니티 스타일 제목 (15~25자, 짧고 궁금증 유발)
- 스크립트: 1인칭 구어체, 짧은 문장으로 리듬감, 줄바꿈으로 호흡 조절
- 길이: 10~15문장 (너무 길지 않게)
- 말투: "~거든", "~잖아", "~인데", "~였어" 등 자연스러운 구어체
- 반드시 JSON 형식으로만 응답: {"title": "제목", "text": "스크립트"}`;

  const resp = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemPrompt,
      history: [{ role: "user", content: `다음 SNS 게시물을 커뮤니티 썰 스크립트로 변환해줘:\n\n${rawText}` }],
    }),
  });
  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({}));
    throw new Error(errData.error || `서버 오류 (${resp.status})`);
  }
  // API는 { text, model } 형식으로 반환 — text가 AI 생성 내용
  const data = await resp.json();
  const aiText = data.text || "";
  // JSON 추출 (마크다운 코드블록 대응)
  const match = aiText.match(/\{[\s\S]*?"title"[\s\S]*?"text"[\s\S]*?\}/);
  if (!match) throw new Error("응답 파싱 실패: " + aiText.slice(0, 100));
  return JSON.parse(match[0]);
}

// ── 포스트 선택 패널 (변환 버튼 포함) ──
function ConvertPanel({ post, onUseRaw, onConfirm, onBack }) {
  const rawText = post.title || post.content || post.text || post.full_text || post.subject || "";
  const [converting, setConverting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function handleConvert() {
    setConverting(true); setError("");
    try {
      const r = await convertToScript(rawText);
      setResult(r);
    } catch (e) {
      setError(e.message || "변환 중 오류가 발생했습니다");
    } finally {
      setConverting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* 뒤로 */}
      <button onClick={onBack} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors w-fit">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
        목록으로
      </button>

      {/* 원문 */}
      <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
        <p className="text-[10px] text-gray-400 font-medium mb-1.5">원문</p>
        <p className="text-xs text-gray-700 whitespace-pre-wrap break-words line-clamp-6">{rawText}</p>
      </div>

      {/* 변환 결과 */}
      {result && (
        <div className="bg-violet-50 rounded-lg p-3 border border-violet-200 flex flex-col gap-2">
          <p className="text-[10px] text-violet-500 font-medium">변환 결과</p>
          <div>
            <p className="text-[10px] text-gray-500 mb-0.5">제목</p>
            <p className="text-sm font-semibold text-gray-800">{result.title}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 mb-0.5">스크립트</p>
            <p className="text-xs text-gray-700 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">{result.text}</p>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500 px-1">{error}</p>}

      {/* 버튼 */}
      <div className="flex gap-2 mt-auto pt-1">
        <button
          onClick={() => onUseRaw(rawText)}
          className="flex-1 px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
        >
          그냥 사용
        </button>
        {result ? (
          <button
            onClick={() => onConfirm(result)}
            className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-all"
          >
            사용하기
          </button>
        ) : (
          <button
            onClick={handleConvert}
            disabled={converting}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-all disabled:opacity-60"
          >
            {converting
              ? <><svg className="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>변환 중...</>
              : <>🤖 커뮤니티 썰로 변환</>
            }
          </button>
        )}
      </div>
    </div>
  );
}

// ── 공통 포스트 리스트 ──
function PostList({ posts, onPreview, emptyMsg, accentClass = "violet" }) {
  const colorMap = {
    blue:   { num: "text-blue-400",   hover: "hover:border-blue-300 hover:bg-blue-50",   arrow: "group-hover:text-blue-400"   },
    purple: { num: "text-purple-400", hover: "hover:border-purple-300 hover:bg-purple-50", arrow: "group-hover:text-purple-400" },
    gray:   { num: "text-gray-400",   hover: "hover:border-gray-400 hover:bg-gray-50",   arrow: "group-hover:text-gray-500"   },
    violet: { num: "text-violet-400", hover: "hover:border-violet-300 hover:bg-violet-50", arrow: "group-hover:text-violet-400" },
  };
  const c = colorMap[accentClass] || colorMap.violet;

  if (posts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-gray-400 text-center px-4 py-8">
        {emptyMsg}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
      {posts.map((post, i) => {
        const text = post.title || post.content || post.text || post.full_text || post.subject || "";
        const meta = post.likes != null ? `❤️ ${(post.likes||0).toLocaleString()}` :
                     post.views != null ? `👁 ${(post.views||0).toLocaleString()}` : "";
        return (
          <button
            key={i}
            onClick={() => onPreview(post)}
            className={`w-full text-left px-3 py-2.5 rounded-lg border border-gray-100 transition-all group ${c.hover}`}
          >
            <div className="flex items-start gap-2">
              <span className={`text-[10px] font-bold flex-shrink-0 mt-0.5 ${c.num}`}>{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-800 group-hover:text-gray-900 whitespace-pre-wrap break-words">{text || "(내용 없음)"}</p>
                {meta && <p className="text-[10px] text-gray-400 mt-0.5">{meta}</p>}
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`flex-shrink-0 text-gray-200 mt-0.5 ml-auto transition-colors ${c.arrow}`}>
                <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
              </svg>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── 수집 상태 뱃지 ──
function CacheBadge({ cache, onClear }) {
  if (!cache?.savedAt || !cache?.posts?.length) return null;
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 border border-green-200 rounded-lg">
      <span className="text-[10px] text-green-600 font-medium">
        {cache.posts.length}개 · {timeAgo(cache.savedAt)} 수집
      </span>
      <button onClick={onClear} className="text-[10px] text-green-400 hover:text-red-400 transition-colors">✕</button>
    </div>
  );
}

// ── 아이보스 탭 (확장 프로그램 기반) ──
function IbossTab({ onSelect }) {
  const cached = loadCache(LS_IBOSS);
  const [month, setMonth] = useState(cached?.month || currentMonth());
  const [posts, setPosts] = useState(cached?.posts || []);
  const [loading, setLoading] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [error, setError] = useState("");
  const [cache, setCache] = useState(cached);
  const timerRef = useRef(null);

  useEffect(() => {
    const handler = (event) => {
      if (event.source !== window) return;
      if (event.data?.type !== "EDEN_IBOSS_LIST") return;
      if (timerRef.current) clearTimeout(timerRef.current);
      const { posts: newPosts = [], error: err } = event.data.payload || {};
      if (err) { setError("수집 오류: " + err); setLoading(false); return; }
      const ranked = newPosts.slice(0, 30).map((p, i) => ({ ...p, rank: i + 1 }));
      setPosts(ranked);
      setLoading(false);
      const c = { month, posts: ranked };
      saveCache(LS_IBOSS, c);
      setCache({ ...c, savedAt: Date.now() });
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [month]);

  function handleFetch() {
    setLoading(true); setError("");
    window.postMessage({ type: "EDEN_GET_IBOSS_LIST", month }, "*");
    timerRef.current = setTimeout(() => {
      setLoading(false);
      setError("수집 시간 초과 — Eden Crawl 확장 프로그램이 설치되어 있고 아이보스에 접근 가능한지 확인하세요");
    }, 20000);
  }

  function handleClear() {
    setPosts([]); setCache(null);
    localStorage.removeItem(LS_IBOSS);
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2 flex-wrap">
        <select value={month} onChange={e => setMonth(e.target.value)}
          className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400"
        >
          {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <button onClick={handleFetch} disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all disabled:opacity-50 flex-shrink-0"
        >
          {loading
            ? <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            : <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          }
          {loading ? "수집 중..." : "가져오기"}
        </button>
        <CacheBadge cache={cache} onClear={handleClear} />
      </div>

      {error && <p className="text-xs text-red-500 px-1">{error}</p>}
      {loading && <p className="text-xs text-blue-500 px-1 animate-pulse">아이보스 인기글 수집 중... (최대 20초)</p>}

      {selectedPost ? (
        <ConvertPanel
          post={selectedPost}
          onBack={() => setSelectedPost(null)}
          onUseRaw={text => onSelect(text)}
          onConfirm={r => onSelect({ title: r.title, text: r.text })}
        />
      ) : (
        <PostList
          posts={posts}
          onPreview={setSelectedPost}
          accentClass="blue"
          emptyMsg={<>월 선택 후 가져오기를 누르세요<br/><span className="text-[10px] text-gray-300 mt-1 block">Eden Crawl 확장 프로그램 필요</span></>}
        />
      )}
    </div>
  );
}

// ── 쓰레드 탭 ──
function ThreadsTab({ onSelect }) {
  const cached = loadCache(LS_THREADS);
  const [keyword, setKeyword] = useState(cached?.keyword || "");
  const [posts, setPosts] = useState(cached?.posts || []);
  const [crawling, setCrawling] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState("");
  const [cache, setCache] = useState(cached);
  const [selectedPost, setSelectedPost] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const handler = (event) => {
      if (event.source !== window) return;
      if (event.data?.type === "EDEN_CRAWL_STATUS") {
        const s = event.data.payload;
        if (s?.error) {
          if (timerRef.current) clearTimeout(timerRef.current);
          setError(s.msg || "수집 오류");
          setCrawling(false);
          setStatusMsg("");
        } else {
          setStatusMsg(s?.msg || "");
        }
      }
      if (event.data?.type === "EDEN_THREADS_RESULTS") {
        if (timerRef.current) clearTimeout(timerRef.current);
        const p = event.data.payload;
        const newPosts = (p?.posts || []).slice(0, 30);
        setPosts(newPosts);
        setCrawling(false);
        setStatusMsg("");
        const c = { keyword: p?.keyword || keyword, posts: newPosts };
        saveCache(LS_THREADS, c);
        setCache({ ...c, savedAt: Date.now() });
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [keyword]);

  function handleStart() {
    if (!keyword.trim()) return;
    setPosts([]); setError(""); setStatusMsg("");
    setCrawling(true);
    window.postMessage({ type: "EDEN_START_CRAWL", keyword: keyword.trim(), count: 20 }, "*");
    timerRef.current = setTimeout(() => {
      setCrawling(false);
      setStatusMsg("");
      setError("수집 시간 초과 — 확장 프로그램이 설치되어 있고 Threads에 로그인되어 있는지 확인하세요");
    }, 180000); // 3분 — 조회수 수집 포함 시 1-2분 소요
  }

  function handleClear() {
    setPosts([]); setCache(null);
    localStorage.removeItem(LS_THREADS);
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2 flex-wrap">
        <input type="text" value={keyword} onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleStart()}
          placeholder="키워드 입력 (예: AI 트렌드)"
          className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-purple-400"
        />
        <button onClick={handleStart} disabled={!keyword.trim() || crawling}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-all disabled:opacity-50 flex-shrink-0"
        >
          {crawling
            ? <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            : "🧵"
          }
          {crawling ? "수집 중..." : "수집"}
        </button>
        <CacheBadge cache={cache} onClear={handleClear} />
      </div>

      {error && <p className="text-xs text-red-500 px-1">{error}</p>}
      {crawling && (
        <p className="text-xs text-purple-500 px-1 animate-pulse">
          {statusMsg || "Threads 수집 시작 중..."}
        </p>
      )}

      {selectedPost ? (
        <ConvertPanel
          post={selectedPost}
          onBack={() => setSelectedPost(null)}
          onUseRaw={text => onSelect(text)}
          onConfirm={r => onSelect({ title: r.title, text: r.text })}
        />
      ) : (
        <PostList
          posts={posts}
          onPreview={setSelectedPost}
          accentClass="purple"
          emptyMsg={<>키워드 입력 후 수집을 누르세요<br/><span className="text-[10px] text-gray-300 mt-1 block">Eden Crawl 확장 프로그램 필요</span></>}
        />
      )}
    </div>
  );
}

// ── X 탭 ──
function XTab({ onSelect }) {
  const cached = loadCache(LS_X);
  const [keyword, setKeyword] = useState(cached?.keyword || "");
  const [posts, setPosts] = useState(cached?.posts || []);
  const [crawling, setCrawling] = useState(false);
  const [error, setError] = useState("");
  const [cache, setCache] = useState(cached);
  const [selectedPost, setSelectedPost] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const handler = (event) => {
      if (event.source !== window) return;
      if (event.data?.type === "EDEN_X_STATUS") {
        const s = event.data.payload;
        if (s?.error) { setError(s.msg || "수집 오류"); setCrawling(false); }
      }
      if (event.data?.type === "EDEN_X_RESULTS") {
        if (timerRef.current) clearTimeout(timerRef.current);
        const p = event.data.payload;
        const newPosts = (p?.posts || []).slice(0, 30);
        setPosts(newPosts);
        setCrawling(false);
        const c = { keyword: p?.keyword || keyword, posts: newPosts };
        saveCache(LS_X, c);
        setCache({ ...c, savedAt: Date.now() });
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [keyword]);

  function handleStart() {
    if (!keyword.trim()) return;
    setPosts([]); setError("");
    setCrawling(true);
    window.postMessage({ type: "EDEN_START_X_CRAWL", keyword: keyword.trim(), count: 20 }, "*");
    timerRef.current = setTimeout(() => {
      setCrawling(false);
      setError("수집 시간 초과 — 확장 프로그램이 설치되어 있고 X에 로그인되어 있는지 확인하세요");
    }, 30000);
  }

  function handleClear() {
    setPosts([]); setCache(null);
    localStorage.removeItem(LS_X);
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2 flex-wrap">
        <input type="text" value={keyword} onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleStart()}
          placeholder="키워드 입력 (예: AI 마케팅)"
          className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-600"
        />
        <button onClick={handleStart} disabled={!keyword.trim() || crawling}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-all disabled:opacity-50 flex-shrink-0"
        >
          {crawling
            ? <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            : <span className="font-bold text-sm">𝕏</span>
          }
          {crawling ? "수집 중..." : "수집"}
        </button>
        <CacheBadge cache={cache} onClear={handleClear} />
      </div>

      {error && <p className="text-xs text-red-500 px-1">{error}</p>}
      {crawling && <p className="text-xs text-gray-500 px-1 animate-pulse">X 인기글 수집 중... (최대 30초)</p>}

      {selectedPost ? (
        <ConvertPanel
          post={selectedPost}
          onBack={() => setSelectedPost(null)}
          onUseRaw={text => onSelect(text)}
          onConfirm={r => onSelect({ title: r.title, text: r.text })}
        />
      ) : (
        <PostList
          posts={posts}
          onPreview={setSelectedPost}
          accentClass="gray"
          emptyMsg={<>키워드 입력 후 수집을 누르세요<br/><span className="text-[10px] text-gray-300 mt-1 block">Eden Crawl 확장 프로그램 필요</span></>}
        />
      )}
    </div>
  );
}

// ── 커뮤니티 썰 탭 ──
// onSelect에 { title, text } 객체 전달 → 호출부에서 용도에 맞게 처리
function CommunityTab({ onSelect }) {
  return (
    <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
      {POPULAR_SCRIPTS.map((p, i) => (
        <button
          key={i}
          onClick={() => onSelect({ title: p.title, text: p.text })}
          className="group w-full text-left px-3 py-3 hover:bg-violet-50 transition-colors flex items-start justify-between gap-2"
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate">{p.title}</p>
            <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">{p.text.slice(0, 60)}…</p>
          </div>
          <svg className="flex-shrink-0 mt-0.5 group-hover:text-violet-500 text-gray-300 transition-colors" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
      ))}
    </div>
  );
}

// ── 메인 TopicPicker ──
const TABS = [
  { key: "iboss",     label: "아이보스",   icon: "🅱" },
  { key: "threads",   label: "쓰레드",     icon: "🧵" },
  { key: "x",         label: "X",          icon: "𝕏" },
  { key: "community", label: "커뮤니티 썰", icon: "💬" },
];

export default function TopicPicker({ onSelect, onClose }) {
  const [tab, setTab] = useState("iboss");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full sm:w-[440px] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col"
        style={{ height: "75vh", maxHeight: "600px" }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 flex-shrink-0">
          <div>
            <h3 className="text-sm font-bold text-gray-800">인기글에서 주제 가져오기</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">항목 클릭 → 주제 자동 입력 · 수집 결과는 자동 저장됩니다</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* 탭 바 */}
        <div className="flex border-b border-gray-100 px-2 flex-shrink-0">
          {TABS.map(t => {
            const hasCache = t.key === "community"
              ? false
              : !!loadCache(
                  t.key === "iboss" ? LS_IBOSS : t.key === "threads" ? LS_THREADS : LS_X
                )?.posts?.length;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                  tab === t.key ? "border-violet-500 text-violet-600" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <span>{t.icon}</span>
                {t.label}
                {hasCache && (
                  <span className="absolute top-1.5 right-1 w-1.5 h-1.5 rounded-full bg-green-400" />
                )}
              </button>
            );
          })}
        </div>

        {/* 탭 내용 */}
        <div className="flex-1 overflow-hidden p-4 flex flex-col min-h-0">
          {tab === "iboss"     && <IbossTab     onSelect={v => { onSelect(v); onClose(); }} />}
          {tab === "threads"   && <ThreadsTab   onSelect={v => { onSelect(v); onClose(); }} />}
          {tab === "x"         && <XTab         onSelect={v => { onSelect(v); onClose(); }} />}
          {tab === "community" && <CommunityTab onSelect={v => { onSelect(v); onClose(); }} />}
        </div>
      </div>
    </div>
  );
}
