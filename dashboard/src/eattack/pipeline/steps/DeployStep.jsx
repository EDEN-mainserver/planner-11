import ErrorBox from "../ErrorBox";
import StepBar from "../StepBar";
import UserBar from "../UserBar";

// 자동화 로그 시각 — "MM/DD HH:mm:ss" 포맷 (날짜 포함)
const fmtLogTime = (iso) => {
  if (!iso) return "지금";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("ko-KR", {
    month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
};

// runId(ig-auto-{epochMs}-{hash6}) → "MM/DD HH:mm · hash6" 사람이 읽을 수 있는 라벨
const humanizeRunId = (runId) => {
  if (!runId) return "-";
  const m = String(runId).match(/^ig-auto-(\d+)-(.+)$/);
  if (!m) return runId;
  const ts = Number(m[1]);
  const hash = m[2];
  if (!Number.isFinite(ts)) return runId;
  const when = new Date(ts).toLocaleString("ko-KR", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  return `${when} · ${hash}`;
};

// 에러 메시지를 사람이 읽을 수 있는 설명 + 원본 코드로 분리
const humanizeError = (raw) => {
  const msg = String(raw || "").trim();
  if (!msg) return null;
  const patterns = [
    { re: /429|rate.?limit|quota|exceeded/i, human: "AI API 호출 한도 초과 — 분당 요청 수가 너무 많습니다. 1분쯤 기다렸다 다시 시도해주세요." },
    { re: /401|unauthorized|invalid.*(key|token)|api.*key.*invalid/i, human: "AI API 키 인증 실패 — Gemini/Instagram API 키를 확인해주세요." },
    { re: /403|forbidden|permission/i, human: "AI API 권한 거부 — 키의 권한 또는 모델 접근권을 확인해주세요." },
    { re: /5\d\d|server error|timeout|ETIMEDOUT|ECONNRESET/i, human: "외부 서버 오류 또는 타임아웃 — 잠시 후 다시 시도해주세요." },
    { re: /network|fetch failed|ENOTFOUND|네트워크/i, human: "네트워크 연결 오류 — 인터넷 연결을 확인해주세요." },
    { re: /duplicate|중복/i, human: "같은 내용의 예약이 이미 존재합니다." },
    { re: /scheduledAt|예약 시간/i, human: "예약 시간 설정이 필요합니다 (시간 또는 날짜)." },
    { re: /계정.*(ID|토큰)|access.?token|account.?id/i, human: "Instagram 계정 연동 정보가 누락됐습니다 — 상단의 계정 연동을 먼저 완료해주세요." },
    { re: /Media ID is not available|컨테이너.*시간 초과|status.?code.*IN_PROGRESS/i, human: "Instagram이 이미지 처리를 아직 안 끝냈어요. 한 번 더 게시 버튼을 눌러주세요 (이미지 7장 캐러셀은 처리에 30~60초 걸립니다)." },
    { re: /컨테이너 처리 실패|status.*ERROR|status.*EXPIRED/i, human: "Instagram이 이미지를 거부했습니다. 이미지 크기·형식·접근 권한을 확인해주세요 (가장 흔한 원인: 이미지 URL이 더 이상 유효하지 않음)." },
    { re: /Request Entity Too Large|413/i, human: "이미지가 너무 큽니다 (4.5MB 한도 초과). 카드뉴스를 다시 생성해서 새 이미지 URL을 받아주세요." },
  ];
  const matched = patterns.find((p) => p.re.test(msg));
  return {
    human: matched ? matched.human : msg,
    code: msg,
  };
};

export default function DeployStep({
  session,
  onLogout,
  step,
  onStepClick,
  cards,
  topic,
  error,
  igConfig,
  setIgConfig,
  saveIgConfig,
  setError,
  igPosting,
  postCaption,
  setPostCaption,
  captionPrompt,
  setCaptionPrompt,
  captionSaving,
  captionGenerating,
  generateCaptionFromPrompt,
  persistCaptionPrompt,
  postToInstagram,
  igResult,
  igLogs,
  setIgLogs,
  igAutoConfig,
  setIgAutoConfig,
  igAutoLoading,
  igAutoSaving,
  igAutoRunning,
  igAutoSchedules,
  igAutoScheduleAt,
  setIgAutoScheduleAt,
  igAutoMessage,
  igAutoMonitor,
  igAutoHistory,
  igAutoMonitorLoading,
  saveInstagramAutoConfig,
  runInstagramAutoResearch,
  scheduleCurrentInstagramCarousel,
  loadInstagramAutoMonitor,
  loadInstagramSchedules,
  cancelInstagramSchedule,
  regenerateAutoCaption,
  clearAutoCaption,
  igAutoCaptionGenerating,
  thConfig,
  thPosting,
  thResult,
  postToThreads,
  setStep,
  reset,
}) {
  return (
    <div className="p-6 space-y-5">
      <UserBar session={session} onLogout={onLogout} />
      <StepBar step={step} onStepClick={onStepClick} />

      {/* 상단: 제목 */}
      <div>
        <p className="text-sm font-bold text-gray-800">배포</p>
        <p className="text-xs text-gray-400">{cards.length}장 · {topic}</p>
      </div>

      {/* 인스타그램 설정 */}
      <div className="space-y-3 bg-gray-50 border border-gray-100 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-pink-500">
            <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
          </svg>
          <p className="text-xs font-bold text-gray-700">인스타그램 자동 게시</p>
          {igConfig.accessToken && igConfig.accountId
            ? <span className="ml-auto text-[10px] font-bold bg-green-100 text-green-600 border border-green-200 rounded-full px-2 py-0.5">연동됨 · @{igConfig.username || igConfig.accountId}</span>
            : <span className="ml-auto text-[10px] text-gray-400">미연동</span>
          }
        </div>

        {/* OAuth 연동 버튼 */}
        {igConfig.accessToken && igConfig.accountId ? (
          <div className="flex items-center justify-between bg-green-50 border border-green-100 rounded-xl px-3 py-2.5">
            <p className="text-xs text-green-700">Instagram 계정이 연동되었습니다.</p>
            <button
              type="button"
              onClick={() => {
                const cleared = { accessToken: "", accountId: "", username: "" };
                setIgConfig(cleared);
                saveIgConfig(cleared);
              }}
              className="text-[10px] text-red-400 hover:text-red-600 font-semibold"
            >
              연동 해제
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              const SCOPES = "instagram_business_basic,instagram_business_content_publish";
              const oauthUrl = `https://www.instagram.com/oauth/authorize?force_reauth=true&client_id=1657867098880562&redirect_uri=https://planforge-ui.vercel.app/auth/instagram/&scope=${SCOPES}&response_type=code&enable_fb_login=0&hide_fb_login=1`;
              const popup = window.open(oauthUrl, "instagram-auth", "width=580,height=720,left=200,top=100");
              const onMessage = (e) => {
                if (e.data?.type !== "instagram_auth") return;
                window.removeEventListener("message", onMessage);
                if (e.data.error) { setError("Instagram 연동 실패: " + e.data.error); return; }
                const next = { accessToken: e.data.accessToken, accountId: e.data.userId, username: e.data.username || "" };
                setIgConfig(next);
                saveIgConfig(next);
              };
              window.addEventListener("message", onMessage);
              const timer = setInterval(() => { if (popup?.closed) { clearInterval(timer); window.removeEventListener("message", onMessage); } }, 500);
            }}
            className="w-full py-2.5 bg-gradient-to-r from-pink-500 to-fuchsia-500 hover:from-pink-600 hover:to-fuchsia-600 text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
            </svg>
            Instagram 계정 연동하기
          </button>
        )}

        {/* 캡션 */}
        <div>
          <label className="text-xs font-bold text-gray-600 block mb-1.5">
            게시 캡션 <span className="font-normal text-gray-400">(선택 — 비우면 주제 사용)</span>
          </label>
          <div className="flex flex-col gap-2">
            <div className="flex flex-col md:flex-row md:items-stretch gap-2">
              <button
                type="button"
                onClick={generateCaptionFromPrompt}
                disabled={captionGenerating || !topic?.trim()}
                className="px-3 py-2 rounded-lg text-[11px] font-bold border border-pink-200 text-pink-600 bg-pink-50 hover:bg-pink-100 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {captionGenerating ? "캡션 생성 중..." : "기획 기반 캡션 작성"}
              </button>
              <textarea
                rows={2}
                placeholder={`캡션 생성 프롬프트 예시:\n{topic} 중심으로 3문장 + CTA + 해시태그 5개`}
                className="flex-1 w-full px-3 py-2 text-[11px] border border-gray-200 rounded-lg outline-none focus:border-violet-400 bg-white resize-none leading-relaxed"
                value={captionPrompt}
                onChange={(e) => setCaptionPrompt(e.target.value)}
              />
              <button
                type="button"
                onClick={persistCaptionPrompt}
                disabled={captionSaving}
                className="px-3 py-2 rounded-lg text-[11px] font-bold border border-gray-200 text-gray-700 bg-gray-50 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {captionSaving ? "저장 중..." : "저장"}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed">
              <code className="text-gray-500">{'{topic}'}</code>,{" "}
              <code className="text-gray-500">{'{brand}'}</code>,{" "}
              <code className="text-gray-500">{'{tone}'}</code>,{" "}
              <code className="text-gray-500">{'{purpose}'}</code>,{" "}
              <code className="text-gray-500">{'{research}'}</code>,{" "}
              <code className="text-gray-500">{'{cards}'}</code> 를 사용할 수 있습니다.
            </p>
          </div>
          <textarea
            rows={3}
            placeholder={`예: ${topic}\n\n#카드뉴스 #정보 #트렌드`}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-violet-400 bg-white resize-none leading-relaxed"
            value={postCaption}
            onChange={(e) => setPostCaption(e.target.value)}
          />
        </div>


        <p className="text-[11px] text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 leading-relaxed">
          🔒 API 정보는 사용자별로 브라우저 로컬에 저장됩니다. 이미지는 서버에 임시 업로드 후 즉시 삭제됩니다.
        </p>

        {/* 게시 버튼 */}
        <button
          onClick={postToInstagram}
          disabled={igPosting || !igConfig.accountId || !igConfig.accessToken}
          className="w-full py-3 bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:from-fuchsia-600 hover:to-pink-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2"
        >
          {igPosting ? (
            <>
              <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              게시 중...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
              </svg>
              인스타그램에 게시하기
            </>
          )}
        </button>

        {igResult?.ok && (
          <div className="px-3 py-2.5 rounded-xl text-xs font-medium bg-green-50 border border-green-200 text-green-700 flex items-start gap-2">
            <span>✅</span>
            <div>
              <span>게시 완료!</span>
              {igResult.permalink && (
                <a href={igResult.permalink} target="_blank" rel="noopener noreferrer" className="block mt-1 underline">
                  게시물 보기
                </a>
              )}
            </div>
          </div>
        )}

        {/* 실행 로그 패널 */}
        {igLogs.length > 0 && (
          <div className="rounded-xl border border-gray-800 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-900">
              <span className="text-[11px] font-bold text-gray-300 font-mono">실행 로그</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(igLogs.join("\n"));
                  }}
                  className="text-[10px] text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 px-2 py-0.5 rounded transition-colors"
                >
                  복사
                </button>
                <button
                  onClick={() => setIgLogs([])}
                  className="text-[10px] text-gray-500 hover:text-gray-300"
                >
                  지우기
                </button>
              </div>
            </div>
            <div className="bg-gray-950 p-3 max-h-48 overflow-y-auto space-y-0.5 font-mono">
              {igLogs.map((line, i) => {
                const isError = line.includes("오류");
                let friendly = null;
                if (isError) {
                  const m = line.match(/오류[:\s]+(.+)$/);
                  if (m) {
                    const info = humanizeError(m[1]);
                    if (info && info.human !== info.code) friendly = info.human;
                  }
                }
                return (
                  <div key={i}>
                    <div className={`text-[11px] leading-relaxed ${isError ? "text-red-400" : "text-gray-300"}`}>
                      {line}
                    </div>
                    {friendly && (
                      <div className="text-[11px] leading-relaxed text-amber-300 ml-4" style={{ fontFamily: "system-ui, sans-serif" }}>
                        ↳ {friendly}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 자동화 / 예약 */}
      <div className="space-y-3 bg-violet-50 border border-violet-100 rounded-2xl p-4">
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold text-violet-800">인스타그램 자동화 · 예약</p>
          <span className="ml-auto text-[10px] text-violet-600 bg-white border border-violet-200 rounded-full px-2 py-0.5">
            쓰레드와 별도 관리
          </span>
        </div>
        <p className="text-[11px] text-violet-700 leading-relaxed">
          키워드를 저장해두면 매일 리서치 → 카드뉴스 생성 → 예약 등록까지 한 번에 이어집니다. 예약된 캐러셀은 Threads와 분리된 인스타그램 전용 큐로 관리됩니다.
        </p>

        <label className="flex items-center gap-2 text-xs font-medium text-violet-900">
          <input
            type="checkbox"
            className="w-4 h-4 accent-violet-500"
            checked={Boolean(igAutoConfig.enabled)}
            onChange={(e) => setIgAutoConfig((prev) => ({ ...prev, enabled: e.target.checked }))}
          />
          자동화 활성화
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <input
            type="text"
            value={igAutoConfig.keywords}
            onChange={(e) => setIgAutoConfig((prev) => ({ ...prev, keywords: e.target.value }))}
            placeholder="리서치 키워드 예: 인스타그램 마케팅, 카드뉴스, 바이럴"
            className="w-full px-3 py-2 text-sm border border-violet-200 rounded-xl outline-none focus:border-violet-400 bg-white"
          />
          <input
            type="time"
            value={igAutoConfig.postTime}
            onChange={(e) => setIgAutoConfig((prev) => ({ ...prev, postTime: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-violet-200 rounded-xl outline-none focus:border-violet-400 bg-white"
          />
          <div className="sm:col-span-2">
            <div className="flex flex-wrap gap-2">
              {[4, 5, 6, 7, 8, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setIgAutoConfig((prev) => ({ ...prev, slideCount: n }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    Number(igAutoConfig.slideCount) === n
                      ? "border-violet-400 bg-violet-100 text-violet-700"
                      : "border-violet-200 bg-white text-violet-600 hover:bg-violet-50"
                  }`}
                >
                  {n}장
                </button>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <textarea
              rows={3}
              value={igAutoConfig.captionTemplate}
              onChange={(e) => setIgAutoConfig((prev) => ({ ...prev, captionTemplate: e.target.value }))}
              placeholder="비워두면 매 게시마다 기획에서 자동 생성됩니다. 또는 {title} {body} {firstBody} {topicTag} 토큰 사용."
              className="w-full px-3 py-2 text-sm border border-violet-200 rounded-xl outline-none focus:border-violet-400 bg-white resize-y leading-relaxed"
            />
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={regenerateAutoCaption}
                disabled={igAutoCaptionGenerating}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100 disabled:opacity-40"
                title="현재 기획(주제·톤·카드 내용)으로 캡션을 새로 생성합니다 — 작성자 핸들/쓰레드 표식 자동 제거"
              >
                {igAutoCaptionGenerating ? "생성 중…" : "✨ 기획으로 새 캡션 생성"}
              </button>
              <button
                type="button"
                onClick={clearAutoCaption}
                disabled={igAutoCaptionGenerating}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-40"
                title="템플릿을 비우면 매 게시마다 기획에서 자동 생성됩니다 (권장)"
              >
                지우기
              </button>
              <span className="text-[10px] text-gray-400 self-center">출처(작성자 핸들·N/N 표식)는 저장 시 자동 제거됨</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveInstagramAutoConfig}
            disabled={igAutoSaving || igAutoLoading}
            className="px-3 py-2 rounded-xl text-xs font-bold border border-violet-300 bg-white text-violet-700 hover:bg-violet-100 disabled:opacity-40"
          >
            {igAutoSaving ? "저장 중..." : "자동화 설정 저장"}
          </button>
          <button
            type="button"
            onClick={runInstagramAutoResearch}
            disabled={igAutoRunning || igAutoLoading}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40"
          >
            {igAutoRunning ? "리서치 중..." : "리서치 → 예약 생성"}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-start">
          <input
            type="datetime-local"
            value={igAutoScheduleAt}
            onChange={(e) => setIgAutoScheduleAt(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-violet-200 rounded-xl outline-none focus:border-violet-400 bg-white"
          />
          <button
            type="button"
            onClick={scheduleCurrentInstagramCarousel}
            disabled={igAutoRunning || !igAutoScheduleAt}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-fuchsia-600 text-white hover:bg-fuchsia-700 disabled:opacity-40"
          >
            현재 카드 예약
          </button>
        </div>

        {igAutoMessage && (
          <div className="px-3 py-2 rounded-xl bg-white border border-violet-200 text-[11px] text-violet-700 leading-relaxed">
            {igAutoMessage}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-violet-800">최근 자동화 로그</p>
            <button
              type="button"
              onClick={() => loadInstagramAutoMonitor()}
              className="text-[10px] font-semibold text-violet-600 hover:text-violet-800"
            >
              새로고침
            </button>
          </div>
          {igAutoMonitorLoading ? (
            <div className="px-3 py-3 rounded-xl border border-violet-100 bg-white text-[11px] text-violet-500">
              로그 불러오는 중...
            </div>
          ) : igAutoMonitor ? (
            <div className="rounded-xl border border-violet-100 bg-white px-3 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  igAutoMonitor.status === "running"
                    ? "bg-violet-50 text-violet-700 border-violet-200"
                    : igAutoMonitor.status === "completed"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : igAutoMonitor.status === "failed"
                        ? "bg-red-50 text-red-600 border-red-200"
                        : "bg-gray-50 text-gray-600 border-gray-200"
                }`}>
                  {igAutoMonitor.status || "idle"}
                </span>
                <span className="text-[10px] text-violet-700" title={igAutoMonitor.runId || ""}>
                  {humanizeRunId(igAutoMonitor.runId)}
                </span>
                {igAutoMonitor.scheduledAt && (
                  <span className="ml-auto text-[10px] text-violet-500">
                    예약 {new Date(igAutoMonitor.scheduledAt).toLocaleString("ko-KR")}
                  </span>
                )}
              </div>
              {(() => {
                const errInfo = humanizeError(igAutoMonitor.error);
                if (errInfo) {
                  return (
                    <div className="space-y-1">
                      <p className="text-[12px] text-red-700 leading-relaxed font-medium">
                        ⚠️ {errInfo.human}
                      </p>
                      <p className="text-[10px] text-gray-500 font-mono break-all">
                        원본: {errInfo.code}
                      </p>
                    </div>
                  );
                }
                return (
                  <p className="text-[12px] text-gray-800 leading-relaxed">
                    {igAutoMonitor.summary || igAutoMonitor.skipReason || "실행 로그가 없습니다."}
                  </p>
                );
              })()}
              {Array.isArray(igAutoMonitor.logs) && igAutoMonitor.logs.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg bg-violet-50/60 p-2">
                  {igAutoMonitor.logs.slice(-8).map((entry, idx) => {
                    const detail = entry?.data?.message || entry?.data?.error || "";
                    return (
                      <div key={`${entry?.time || idx}-${idx}`} className="text-[11px] leading-relaxed text-gray-700">
                        <span className="font-mono text-violet-500 mr-2">
                          {fmtLogTime(entry?.time)}
                        </span>
                        <span className={entry?.msg === "오류" ? "text-red-600 font-semibold" : ""}>
                          {entry?.msg || ""}
                        </span>
                        {detail && (
                          <span className="ml-2 font-mono text-[10px] text-gray-500">— {detail}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {igAutoHistory.length > 0 && (
                <div className="text-[10px] text-violet-500">
                  최근 실행 {igAutoHistory.length}건 중 {Math.min(igAutoHistory.length, 5)}건 표시
                </div>
              )}
            </div>
          ) : (
            <div className="px-3 py-3 rounded-xl border border-violet-100 bg-white text-[11px] text-violet-500">
              아직 자동화 로그가 없습니다.
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-violet-800">예약 큐</p>
            <button
              type="button"
              onClick={loadInstagramSchedules}
              className="text-[10px] font-semibold text-violet-600 hover:text-violet-800"
            >
              새로고침
            </button>
          </div>
          {igAutoSchedules.length === 0 ? (
            <div className="px-3 py-3 rounded-xl border border-violet-100 bg-white text-[11px] text-violet-500">
              예약된 인스타그램 캐러셀이 없습니다.
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {igAutoSchedules
                .slice()
                .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
                .map((item) => (
                  <div key={item.id} className="rounded-xl border border-violet-100 bg-white px-3 py-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-violet-50 text-violet-700 border-violet-200">
                        {item.auto ? "자동" : "수동"}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        item.status === "pending" && item.retryAt
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : item.status === "pending"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : item.status === "posted"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-red-50 text-red-600 border-red-200"
                      }`}>
                        {item.status === "pending" && item.retryAt ? "재시도 대기" : item.status}
                      </span>
                      <span className="ml-auto text-[10px] text-violet-500 font-mono">
                        {item.images?.length || item.imageUrls?.length || 0}장
                      </span>
                    </div>
                    <p className="text-[12px] text-gray-800 leading-relaxed line-clamp-2">
                      {item.caption || item.text || item.topic || "-"}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      예약: {new Date(item.scheduledAt).toLocaleString("ko-KR")}
                    </p>
                    {item.retryAt && item.status === "pending" && (
                      <p className="text-[10px] text-blue-500">
                        재시도: {new Date(item.retryAt).toLocaleString("ko-KR")}
                      </p>
                    )}
                    {item.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => cancelInstagramSchedule(item.id)}
                        className="text-[10px] font-semibold text-red-500 hover:text-red-700"
                      >
                        예약 취소
                      </button>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Threads ── */}
      <div className="space-y-3 bg-gray-50 border border-gray-100 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-5 h-5 rounded bg-gray-900 flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4"/>
              <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>
            </svg>
          </div>
          <p className="text-xs font-bold text-gray-700">스레드 (Threads)</p>
          <span className="text-[10px] text-gray-500 font-semibold bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5">
            {session.displayName} 계정
          </span>
          {thConfig.userId && thConfig.accessToken && (
            <span className="ml-auto text-[10px] font-bold bg-green-100 text-green-600 border border-green-200 rounded-full px-2 py-0.5">연동됨</span>
          )}
        </div>

        {thConfig.userId && thConfig.accessToken ? (
          <>
            <p className="text-xs text-gray-500">
              연동된 계정으로 게시합니다. 변경은 관리자 → 소셜 계정 연동에서.
            </p>
            <button
              onClick={postToThreads}
              disabled={thPosting}
              className="w-full py-2.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {thPosting ? (
                <>
                  <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  스레드에 게시 중...
                </>
              ) : "스레드에 게시하기"}
            </button>
            {thResult && (
              <div className="px-3 py-2 rounded-xl text-xs font-medium bg-green-50 border border-green-200 text-green-700 flex items-start gap-2">
                <span>✅</span>
                <div>
                  <span>{thResult.message}</span>
                  {thResult.permalink && (
                    <a href={thResult.permalink} target="_blank" rel="noopener noreferrer" className="block mt-1 underline">게시물 보기</a>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-gray-400 bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2">
            관리자 → 소셜 계정 연동에서 스레드 API를 먼저 설정해주세요.
          </p>
        )}
      </div>

      {error && <ErrorBox msg={error} />}

      <div className="flex gap-2">
        <button
          onClick={() => setStep("assembly")}
          className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-all"
        >
          ← 카드 편집
        </button>
        <button
          onClick={reset}
          className="flex-1 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-700 transition-all"
        >
          새 콘텐츠 만들기
        </button>
      </div>
    </div>
  );
}
