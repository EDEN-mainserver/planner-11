"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { outreachApi, type Keyword, type SettingsMap } from "@/lib/outreach-api";

export default function OutreachHomePage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 새 키워드 폼
  const [newKeyword, setNewKeyword] = useState("");
  const [creating, setCreating] = useState(false);

  // 단독 테스트 결과 (검색)
  const [testKeyword, setTestKeyword] = useState("");
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<unknown>(null);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const [kw, st] = await Promise.all([
        outreachApi.listKeywords(),
        outreachApi.listSettings(),
      ]);
      setKeywords(kw.keywords);
      setSettings(st);
    } catch (e) {
      setError(e instanceof Error ? e.message : "백엔드 연결 실패 — uvicorn 실행 중인지 확인");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleCreate = async () => {
    if (!newKeyword.trim()) return;
    setCreating(true);
    try {
      await outreachApi.createKeyword({ keyword: newKeyword.trim() });
      setNewKeyword("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "키워드 생성 실패");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제할까요?")) return;
    await outreachApi.deleteKeyword(id);
    await refresh();
  };

  const handleTogglePause = async () => {
    const isPaused = !!settings.paused;
    if (isPaused) await outreachApi.resume();
    else await outreachApi.pause();
    await refresh();
  };

  const handleTestSearch = async () => {
    if (!testKeyword.trim()) return;
    setTestRunning(true);
    setTestResult(null);
    try {
      const r = await outreachApi.testSearch({ keyword: testKeyword.trim() });
      setTestResult(r);
    } catch (e) {
      setTestResult({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      setTestRunning(false);
    }
  };

  const isPaused = !!settings.paused;
  const dailyCap = (settings.daily_cap as number | undefined) ?? 30;

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">키워드</h1>
        <button
          onClick={handleTogglePause}
          className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
            isPaused
              ? "bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
              : "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
          }`}
        >
          {isPaused ? "⏸ 일시정지됨" : "▶ 실행 중"}
        </button>
      </div>

      <div className="text-sm text-muted-foreground mb-6">
        일 발송 한도: <strong className="text-foreground">{dailyCap}통</strong> ·{" "}
        <Link href="/outreach/settings" className="text-primary hover:underline">
          설정 →
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* 새 키워드 추가 */}
      <div className="mb-8 p-4 border rounded-lg bg-card">
        <h2 className="text-sm font-semibold mb-3">새 키워드 추가</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="예: ai 프로그램"
            className="flex-1 px-3 py-2 border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newKeyword.trim()}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
          >
            {creating ? "..." : "추가"}
          </button>
        </div>
      </div>

      {/* 키워드 리스트 */}
      <div className="mb-8">
        {loading ? (
          <p className="text-muted-foreground text-sm">불러오는 중...</p>
        ) : keywords.length === 0 ? (
          <p className="text-muted-foreground text-sm">등록된 키워드가 없습니다.</p>
        ) : (
          <ul className="border rounded-lg divide-y bg-card">
            {keywords.map((k) => (
              <li key={k.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{k.keyword}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {k.region} / {k.language} / top {k.top_n} ·{" "}
                    {k.auto_send ? "🟢 자동발송" : "🟡 드래프트만"} ·{" "}
                    {k.enabled ? "활성" : "비활성"}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(k.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Day 1 단독 테스트: Search Agent */}
      <div className="p-4 border rounded-lg bg-muted/30">
        <h2 className="text-sm font-semibold mb-3">
          🧪 단독 테스트: 1. 검색 (Search Agent)
        </h2>
        <p className="text-xs text-muted-foreground mb-3">
          Playwright로 구글 검색 결과 상위 10개를 가져옵니다. CAPTCHA로 막히면 settings에 SerpAPI 키 넣으세요.
        </p>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={testKeyword}
            onChange={(e) => setTestKeyword(e.target.value)}
            placeholder="검색할 키워드"
            className="flex-1 px-3 py-2 border rounded-md text-sm bg-background"
          />
          <button
            onClick={handleTestSearch}
            disabled={testRunning || !testKeyword.trim()}
            className="px-4 py-2 rounded-md bg-foreground text-background text-sm font-medium disabled:opacity-50"
          >
            {testRunning ? "검색 중..." : "검색"}
          </button>
        </div>
        {testResult !== null && (
          <pre className="text-xs bg-background border rounded p-3 overflow-auto max-h-96">
            {JSON.stringify(testResult, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
