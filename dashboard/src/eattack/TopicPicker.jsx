/**
 * 주제 가져오기 패널
 * 소스: 아이보스(API) / 쓰레드(확장) / X(확장)
 * Props: onSelect(topicString), onClose
 */
import { useState, useEffect, useRef } from "react";

const IS_LOCAL = window.location.hostname === "localhost";

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

// ── 아이보스 탭 ──
function IbossTab({ onSelect }) {
  const [month, setMonth] = useState(currentMonth());
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchPosts() {
    setLoading(true); setError(""); setPosts([]);
    try {
      const url = IS_LOCAL
        ? `http://localhost:8001/api/crawl/iboss?limit=30&month=${month}`
        : `/api/iboss-crawl?limit=30&month=${month}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("API 오류 " + res.status);
      const data = await res.json();
      setPosts((data.posts || data || []).slice(0, 30));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2">
        <select
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400"
        >
          {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <button
          onClick={fetchPosts}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all disabled:opacity-50"
        >
          {loading
            ? <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            : <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          }
          {loading ? "수집 중..." : "가져오기"}
        </button>
      </div>

      {error && <p className="text-xs text-red-500 px-1">{error}</p>}

      {posts.length === 0 && !loading && (
        <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
          월을 선택하고 가져오기를 눌러주세요
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
        {posts.map((post, i) => (
          <button
            key={i}
            onClick={() => onSelect(post.title || post.subject || "")}
            className="w-full text-left px-3 py-2.5 rounded-lg border border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition-all group"
          >
            <div className="flex items-start gap-2">
              <span className="text-[10px] font-bold text-blue-400 flex-shrink-0 mt-0.5">{i + 1}</span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-800 line-clamp-2 group-hover:text-blue-700">
                  {post.title || post.subject || "(제목 없음)"}
                </p>
                {(post.views || post.view_count) && (
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    조회 {(post.views || post.view_count || 0).toLocaleString()}
                  </p>
                )}
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-gray-300 group-hover:text-blue-400 mt-0.5 ml-auto">
                <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── 쓰레드 탭 ──
function ThreadsTab({ onSelect }) {
  const [keyword, setKeyword] = useState("");
  const [count] = useState(20);
  const [posts, setPosts] = useState([]);
  const [crawling, setCrawling] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const timerRef = useRef(null);

  useEffect(() => {
    const handler = (event) => {
      if (event.source !== window) return;
      if (event.data?.type === "EDEN_CRAWL_STATUS") {
        const s = event.data.payload;
        if (s?.error) { setError(s.msg || "수집 오류"); setCrawling(false); }
      }
      if (event.data?.type === "EDEN_THREADS_RESULTS") {
        if (timerRef.current) clearTimeout(timerRef.current);
        const p = event.data.payload;
        setPosts((p?.posts || []).slice(0, 30));
        setCrawling(false);
        setDone(true);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  function handleStart() {
    if (!keyword.trim()) return;
    setPosts([]); setDone(false); setError("");
    setCrawling(true);
    window.postMessage({ type: "EDEN_START_CRAWL", keyword: keyword.trim(), count }, "*");
    timerRef.current = setTimeout(() => {
      setCrawling(false);
      setError("수집 시간 초과 — 확장 프로그램이 설치되어 있고 Threads에 로그인되어 있는지 확인하세요");
    }, 30000);
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleStart()}
          placeholder="키워드 입력 (예: AI 트렌드)"
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-purple-400"
        />
        <button
          onClick={handleStart}
          disabled={!keyword.trim() || crawling}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-all disabled:opacity-50"
        >
          {crawling
            ? <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            : "수집"
          }
          {crawling ? "수집 중..." : "수집"}
        </button>
      </div>

      {error && <p className="text-xs text-red-500 px-1">{error}</p>}
      {crawling && (
        <p className="text-xs text-purple-500 px-1 animate-pulse">Threads에서 인기글 수집 중... (최대 30초)</p>
      )}

      {posts.length === 0 && !crawling && !error && (
        <div className="flex-1 flex items-center justify-center text-xs text-gray-400 text-center px-4">
          키워드 입력 후 수집을 누르세요<br />
          <span className="text-[10px] text-gray-300 mt-1 block">Eden Crawl 확장 프로그램 필요</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
        {posts.map((post, i) => {
          const text = post.content || post.text || post.body || "";
          return (
            <button
              key={i}
              onClick={() => onSelect(text.slice(0, 100))}
              className="w-full text-left px-3 py-2.5 rounded-lg border border-gray-100 hover:border-purple-300 hover:bg-purple-50 transition-all group"
            >
              <div className="flex items-start gap-2">
                <span className="text-[10px] font-bold text-purple-400 flex-shrink-0 mt-0.5">{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-xs text-gray-800 line-clamp-2 group-hover:text-purple-700">{text || "(내용 없음)"}</p>
                  {post.likes != null && (
                    <p className="text-[10px] text-gray-400 mt-0.5">❤️ {(post.likes || 0).toLocaleString()}</p>
                  )}
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-gray-300 group-hover:text-purple-400 mt-0.5 ml-auto">
                  <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                </svg>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── X 탭 ──
function XTab({ onSelect }) {
  const [keyword, setKeyword] = useState("");
  const [count] = useState(20);
  const [posts, setPosts] = useState([]);
  const [crawling, setCrawling] = useState(false);
  const [error, setError] = useState("");
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
        setPosts((p?.posts || []).slice(0, 30));
        setCrawling(false);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  function handleStart() {
    if (!keyword.trim()) return;
    setPosts([]); setError("");
    setCrawling(true);
    window.postMessage({ type: "EDEN_START_X_CRAWL", keyword: keyword.trim(), count }, "*");
    timerRef.current = setTimeout(() => {
      setCrawling(false);
      setError("수집 시간 초과 — 확장 프로그램이 설치되어 있고 X에 로그인되어 있는지 확인하세요");
    }, 30000);
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleStart()}
          placeholder="키워드 입력 (예: AI 마케팅)"
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-600"
        />
        <button
          onClick={handleStart}
          disabled={!keyword.trim() || crawling}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-all disabled:opacity-50"
        >
          {crawling
            ? <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            : <span className="font-bold">𝕏</span>
          }
          {crawling ? "수집 중..." : "수집"}
        </button>
      </div>

      {error && <p className="text-xs text-red-500 px-1">{error}</p>}
      {crawling && (
        <p className="text-xs text-gray-500 px-1 animate-pulse">X에서 인기글 수집 중... (최대 30초)</p>
      )}

      {posts.length === 0 && !crawling && !error && (
        <div className="flex-1 flex items-center justify-center text-xs text-gray-400 text-center px-4">
          키워드 입력 후 수집을 누르세요<br />
          <span className="text-[10px] text-gray-300 mt-1 block">Eden Crawl 확장 프로그램 필요</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
        {posts.map((post, i) => {
          const text = post.content || post.text || post.full_text || "";
          return (
            <button
              key={i}
              onClick={() => onSelect(text.slice(0, 100))}
              className="w-full text-left px-3 py-2.5 rounded-lg border border-gray-100 hover:border-gray-400 hover:bg-gray-50 transition-all group"
            >
              <div className="flex items-start gap-2">
                <span className="text-[10px] font-bold text-gray-400 flex-shrink-0 mt-0.5">{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-xs text-gray-800 line-clamp-2 group-hover:text-gray-900">{text || "(내용 없음)"}</p>
                  <div className="flex gap-2 mt-0.5">
                    {post.likes != null && <span className="text-[10px] text-gray-400">❤️ {(post.likes || 0).toLocaleString()}</span>}
                    {post.retweets != null && <span className="text-[10px] text-gray-400">🔁 {(post.retweets || 0).toLocaleString()}</span>}
                  </div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-gray-300 group-hover:text-gray-500 mt-0.5 ml-auto">
                  <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                </svg>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── 메인 TopicPicker ──
const TABS = [
  { key: "iboss",   label: "아이보스", icon: "🅱", color: "blue" },
  { key: "threads", label: "쓰레드",   icon: "🧵", color: "purple" },
  { key: "x",       label: "X",        icon: "𝕏",  color: "gray" },
];

export default function TopicPicker({ onSelect, onClose }) {
  const [tab, setTab] = useState("iboss");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full sm:w-[420px] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: "80vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-bold text-gray-800">인기글에서 주제 가져오기</h3>
            <p className="text-xs text-gray-400 mt-0.5">항목을 클릭하면 주제로 자동 입력됩니다</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* 탭 바 */}
        <div className="flex border-b border-gray-100 px-2 pt-1">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                tab === t.key
                  ? "border-violet-500 text-violet-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* 탭 내용 */}
        <div className="flex-1 overflow-hidden p-4" style={{ minHeight: 0 }}>
          {tab === "iboss"   && <IbossTab   onSelect={v => { onSelect(v); onClose(); }} />}
          {tab === "threads" && <ThreadsTab onSelect={v => { onSelect(v); onClose(); }} />}
          {tab === "x"       && <XTab       onSelect={v => { onSelect(v); onClose(); }} />}
        </div>
      </div>
    </div>
  );
}
