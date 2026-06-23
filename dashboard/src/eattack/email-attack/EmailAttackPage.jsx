// E-MAIL Attack 메인 페이지 — 라우팅 진입점
// 다른 eattack 모듈과 분리: 이 폴더 안에서만 모든 로직 처리
//
// 구조:
//   ┌ KeywordInput (키워드 + 소스 선택)
//   ├ JobProgress (실시간 진행)
//   ├ ResultsTable (발굴 결과)
//   └ JobHistory (사이드 패널)

import { useEffect, useRef, useState, useCallback } from "react";
import KeywordInput from "./components/KeywordInput";
import JobProgress from "./components/JobProgress";
import ResultsTable from "./components/ResultsTable";
import JobHistory from "./components/JobHistory";
import MyInfoModal from "./components/MyInfoModal";
import ProposalsPanel from "./components/ProposalsPanel";
import { emailAttackApi } from "./api/client";

const POLL_INTERVAL_MS = 2000;

export default function EmailAttackPage({ onBack }) {
  const [jobs, setJobs] = useState([]);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [currentJob, setCurrentJob] = useState(null);
  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef(null);

  // 제안서 생성 관련 상태
  const [myInfoOpen, setMyInfoOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState("");
  const [genErrors, setGenErrors] = useState([]);
  const [showProposals, setShowProposals] = useState(false);

  // 작업 히스토리 새로고침
  const refreshJobs = useCallback(async () => {
    try {
      const { jobs } = await emailAttackApi.listJobs();
      setJobs(jobs);
    } catch (e) {
      console.error("[ea/jobs]", e);
    }
  }, []);

  // 특정 작업 상태 + 결과 폴링
  const loadJob = useCallback(async (jobId) => {
    try {
      const { job, results } = await emailAttackApi.status(jobId);
      setCurrentJob(job);
      setResults(results || []);
      // 작업이 끝났으면 폴링 중단
      if (job.status === "done" || job.status === "failed" || job.status === "canceled") {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        setRunning(false);
        // 히스토리도 갱신 (완료 표시)
        refreshJobs();
      }
    } catch (e) {
      console.error("[ea/status]", e);
    }
  }, [refreshJobs]);

  // 새 작업 시작
  const handleRun = async ({ keyword, sources, targetCount }) => {
    setError("");
    setRunning(true);
    setResults([]);

    try {
      // run.js는 동기로 5분 안에 끝남. 그 동안 status 폴링으로 진행상황 표시.
      const runPromise = emailAttackApi.run({ keyword, sources, targetCount });

      // job_id를 알아내려면 첫 응답이 와야 함. 폴링은 listJobs로 최신 잡 찾는 방식.
      // 그 전에 jobs 갱신해서 새 잡 잡아내기 (1초 후)
      setTimeout(async () => {
        await refreshJobs();
        const { jobs: latest } = await emailAttackApi.listJobs();
        const newest = latest[0];
        if (newest && newest.keyword === keyword) {
          setCurrentJobId(newest.id);
          // 폴링 시작
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = setInterval(() => loadJob(newest.id), POLL_INTERVAL_MS);
          loadJob(newest.id);
        }
      }, 1500);

      // run 완료 대기 (5분까지)
      const result = await runPromise;
      if (result.job_id) {
        setCurrentJobId(result.job_id);
        await loadJob(result.job_id);
      }
    } catch (e) {
      setError(e.message);
      setRunning(false);
    }
  };

  // 작업 선택 (히스토리에서 클릭)
  const handleSelect = (jobId) => {
    setCurrentJobId(jobId);
    loadJob(jobId);
  };

  // 제안서 생성 시작 (모달 → 확인 콜백)
  const handleGenerateConfirm = async (sender) => {
    setMyInfoOpen(false);
    if (!currentJobId) return;
    setGenerating(true);
    setGenErrors([]);
    setGenStatus(`AI로 ${results.length}개 제안서 생성 중... (1~3분)`);
    try {
      const result = await emailAttackApi.generateProposals({
        jobId: currentJobId,
        sender,
        onlyMissing: true,
      });
      const errCount = (result.errors || []).length;
      setGenErrors(result.errors || []);
      setGenStatus(
        `완료: 생성 ${result.generated}건 · 스킵 ${result.skipped}건` +
          (errCount > 0 ? ` · 실패 ${errCount}건` : "")
      );
      setShowProposals(true);
    } catch (e) {
      setGenStatus("실패: " + e.message);
      setGenErrors([]);
    } finally {
      setGenerating(false);
    }
  };

  // 작업 삭제
  const handleDelete = async (jobId) => {
    await emailAttackApi.deleteJob(jobId);
    if (jobId === currentJobId) {
      setCurrentJobId(null);
      setCurrentJob(null);
      setResults([]);
    }
    refreshJobs();
  };

  // 초기 로드
  useEffect(() => {
    refreshJobs();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refreshJobs]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-white">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="text-sm text-gray-500 hover:text-gray-900"
              >
                ← 돌아가기
              </button>
            )}
            <div>
              <h1 className="text-xl font-bold text-gray-900">E-MAIL Attack</h1>
              <p className="text-xs text-gray-500">
                키워드 1개로 영업 타겟 브랜드의 이메일·홈페이지·상호명 자동 발굴
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* 본문 */}
      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* 메인 영역 */}
        <div className="space-y-4">
          <KeywordInput onRun={handleRun} running={running} />

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          {currentJob && <JobProgress job={currentJob} />}

          <ResultsTable
            results={results}
            onGenerateProposals={
              results.length > 0 && !generating ? () => setMyInfoOpen(true) : null
            }
          />

          {(generating || genStatus) && (
            <div
              className={`p-4 rounded-xl text-sm ${
                generating
                  ? "bg-amber-50 border border-amber-200 text-amber-900"
                  : genStatus.startsWith("실패")
                  ? "bg-red-50 border border-red-200 text-red-700"
                  : "bg-green-50 border border-green-200 text-green-700"
              }`}
            >
              {generating && <span className="mr-2 animate-pulse">●</span>}
              {genStatus}
              {genErrors.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs">
                  {genErrors.slice(0, 3).map((err, idx) => (
                    <li key={`${err.domain || "error"}-${idx}`}>
                      {err.domain && <strong>{err.domain}: </strong>}
                      {err.error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {showProposals && currentJobId && (
            <ProposalsPanel
              jobId={currentJobId}
              onClose={() => setShowProposals(false)}
            />
          )}
        </div>

        {/* 사이드 패널 */}
        <aside>
          <JobHistory
            jobs={jobs}
            currentJobId={currentJobId}
            onSelect={handleSelect}
            onDelete={handleDelete}
          />
        </aside>
      </main>

      <MyInfoModal
        open={myInfoOpen}
        onClose={() => setMyInfoOpen(false)}
        onConfirm={handleGenerateConfirm}
        resultCount={results.length}
      />
    </div>
  );
}
