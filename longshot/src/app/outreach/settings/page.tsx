"use client";

import { useEffect, useState } from "react";
import { outreachApi, type SettingsMap } from "@/lib/outreach-api";

export default function OutreachSettingsPage() {
  const [s, setS] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  // 발송 드라이런 테스트
  const [testTo, setTestTo] = useState("");
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<unknown>(null);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      setS(await outreachApi.listSettings());
    } catch (e) {
      setError(e instanceof Error ? e.message : "로드 실패");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const save = async (key: string, value: unknown) => {
    setSavingKey(key);
    try {
      await outreachApi.patchSetting(key, value);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSavingKey(null);
    }
  };

  const handleTestSend = async () => {
    if (!testTo.trim()) return;
    setTestRunning(true);
    setTestResult(null);
    try {
      const r = await outreachApi.testSend({ to: testTo.trim() });
      setTestResult(r);
    } catch (e) {
      setTestResult({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      setTestRunning(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">불러오는 중...</div>;
  }

  return (
    <div className="p-8 max-w-3xl space-y-8">
      <h1 className="text-2xl font-bold">설정</h1>

      {error && (
        <div className="p-4 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* 내 서비스 소개 */}
      <section className="p-5 border rounded-lg bg-card">
        <h2 className="font-semibold mb-2">내 서비스 소개</h2>
        <p className="text-xs text-muted-foreground mb-3">
          모든 제안서 생성에 자동으로 들어갑니다. 에덴이 제공하는 서비스, 강점, 사례 등을 자유롭게 적어주세요.
        </p>
        <textarea
          defaultValue={(s.service_description as string) || ""}
          rows={8}
          className="w-full px-3 py-2 border rounded-md text-sm bg-background"
          onBlur={(e) => {
            if (e.target.value !== s.service_description) {
              save("service_description", e.target.value);
            }
          }}
        />
        {savingKey === "service_description" && (
          <p className="text-xs text-muted-foreground mt-2">저장 중...</p>
        )}
      </section>

      {/* 발신자 정보 */}
      <section className="p-5 border rounded-lg bg-card">
        <h2 className="font-semibold mb-2">발신자 정보</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-muted-foreground">이름</span>
            <input
              type="text"
              defaultValue={(s.sender_name as string) || ""}
              onBlur={(e) => e.target.value !== s.sender_name && save("sender_name", e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm bg-background mt-1"
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">이메일 (Gmail SMTP)</span>
            <input
              type="email"
              defaultValue={(s.sender_email as string) || ""}
              onBlur={(e) => e.target.value !== s.sender_email && save("sender_email", e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm bg-background mt-1"
            />
          </label>
        </div>
      </section>

      {/* 발송 안전장치 */}
      <section className="p-5 border rounded-lg bg-card">
        <h2 className="font-semibold mb-2">발송 안전장치</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-muted-foreground">일 발송 한도 (통)</span>
            <input
              type="number"
              defaultValue={(s.daily_cap as number) || 30}
              onBlur={(e) => {
                const n = Number(e.target.value);
                if (!Number.isNaN(n) && n !== s.daily_cap) save("daily_cap", n);
              }}
              className="w-full px-3 py-2 border rounded-md text-sm bg-background mt-1"
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">드래프트 임계값 (통)</span>
            <input
              type="number"
              defaultValue={(s.draft_mode_threshold as number) || 10}
              onBlur={(e) => {
                const n = Number(e.target.value);
                if (!Number.isNaN(n) && n !== s.draft_mode_threshold)
                  save("draft_mode_threshold", n);
              }}
              className="w-full px-3 py-2 border rounded-md text-sm bg-background mt-1"
            />
            <span className="text-xs text-muted-foreground">
              누적 N통까지는 수동 승인 → 이후 auto_send 토글 해제
            </span>
          </label>
        </div>
      </section>

      {/* SerpAPI */}
      <section className="p-5 border rounded-lg bg-card">
        <h2 className="font-semibold mb-2">검색 폴백 (SerpAPI)</h2>
        <p className="text-xs text-muted-foreground mb-3">
          비워두면 Playwright 직접 스크래핑. 구글 CAPTCHA로 막히면 여기에 SerpAPI 키를 넣으면 자동 전환됩니다.
        </p>
        <input
          type="password"
          placeholder="(비워두면 Playwright 사용)"
          defaultValue={(s.serpapi_key as string) || ""}
          onBlur={(e) => e.target.value !== s.serpapi_key && save("serpapi_key", e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm bg-background font-mono"
        />
      </section>

      {/* Day 1 단독 테스트: Email Sender */}
      <section className="p-5 border rounded-lg bg-muted/30">
        <h2 className="font-semibold mb-2">🧪 단독 테스트: 5. 발송 (드라이런)</h2>
        <p className="text-xs text-muted-foreground mb-3">
          실제로 발송하지 않고, 생성될 MIME 메시지만 미리봅니다. 수신거부 푸터·헤더 확인용.
        </p>
        <div className="flex gap-2 mb-3">
          <input
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="테스트 받을 이메일"
            className="flex-1 px-3 py-2 border rounded-md text-sm bg-background"
          />
          <button
            onClick={handleTestSend}
            disabled={testRunning || !testTo.trim()}
            className="px-4 py-2 rounded-md bg-foreground text-background text-sm font-medium disabled:opacity-50"
          >
            {testRunning ? "..." : "드라이런"}
          </button>
        </div>
        {testResult !== null && (
          <pre className="text-xs bg-background border rounded p-3 overflow-auto max-h-96">
            {JSON.stringify(testResult, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}
