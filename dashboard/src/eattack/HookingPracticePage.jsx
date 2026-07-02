import { useEffect, useMemo, useState } from "react";
import {
  EXAM_QUESTION_COUNT as BANK_EXAM_QUESTION_COUNT,
  buildQuestion as buildBankQuestion,
} from "./hooking-bank";

const USED_PERSONAS_KEY = "hooking-practice-used-personas-v1";
const EXAM_HISTORY_KEY = "hooking-exam-history-v1";
const EXAM_QUESTION_COUNT = BANK_EXAM_QUESTION_COUNT;
const EMPTY_PERSONA = {
  brand: "생성 중",
  owner: "AI가 새로운 광고주를 만드는 중입니다",
  product: "새로운 숏폼 판매 상품",
  audience: "새로운 구매자 타겟",
  pain: "새로운 마케팅 문제",
  desire: "숏폼으로 얻고 싶은 변화",
  objection: "구매 전 망설임",
  fingerprint: "",
};

function loadUsedPersonas() {
  try {
    const parsed = JSON.parse(localStorage.getItem(USED_PERSONAS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveUsedPersonas(values) {
  localStorage.setItem(USED_PERSONAS_KEY, JSON.stringify(values.slice(-500)));
}

function loadExamHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(EXAM_HISTORY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveExamHistory(values) {
  localStorage.setItem(EXAM_HISTORY_KEY, JSON.stringify(values.slice(0, 50)));
}

function localFingerprint(persona) {
  return [
    persona.brand,
    persona.owner,
    persona.product,
    persona.audience,
    persona.pain,
  ]
    .map((v) => String(v || "").replace(/\s+/g, " ").trim())
    .join("|")
    .toLowerCase();
}

async function requestGeneratedPersona() {
  const used = loadUsedPersonas();
  let lastPersona = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const resp = await fetch("/api/hooking-persona", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ used }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || "페르소나 생성 실패");
    const persona = data.persona;
    const fp = persona.fingerprint || localFingerprint(persona);
    lastPersona = { ...persona, fingerprint: fp };
    if (!used.includes(fp)) {
      const nextUsed = [...used, fp];
      saveUsedPersonas(nextUsed);
      return lastPersona;
    }
  }
  if (lastPersona) {
    saveUsedPersonas([...used, lastPersona.fingerprint]);
    return lastPersona;
  }
  throw new Error("페르소나 생성 실패");
}

function assessFirstHookQuality(text) {
  const hook = String(text || "").trim();
  const problems = [];
  if (/(예약하세요|신청하세요|구매하세요|문의하세요|클릭하세요|바로\s*예약|바로\s*신청|지금\s*바로)/i.test(hook)) {
    problems.push("첫 문장부터 행동을 요구해 후킹보다 CTA에 가깝습니다.");
  }
  if (/^(친구한테|친구처럼|나 믿고|솔직히|알려드릴게요|소개합니다|말할게요)/.test(hook) && hook.length < 32) {
    problems.push("친근한 말투만 있고 타겟·문제·볼 이유가 부족합니다.");
  }
  if (!/(왜|이유|모르는|놓치|망설|실수|손해|문제|고민|대표님|고객|분들|라면|POV|가지|초|분|주말|지금|마지막)/.test(hook)) {
    problems.push("첫 1초에 멈출 궁금증, 손실감, 대상 호명이 약합니다.");
  }
  if (hook.length < 16) {
    problems.push("문장이 너무 짧아 숏폼 첫후킹으로 맥락이 부족합니다.");
  }
  return {
    ok: problems.length === 0,
    problems,
  };
}

function gradeChoice(question, answer) {
  const correct = answer === question.answer;
  const picked = question.options.find((item) => item.key === answer);
  const target = question.target;
  const pickedTell = picked?.tell || picked?.hint || picked?.goal || picked?.awareness || "";
  const targetTell = target?.tell || target?.hint || target?.goal || target?.awareness || "";
  const quality = question.kind === "chooseHook" ? assessFirstHookQuality(question.example) : { ok: true, problems: [] };
  const score = correct ? (quality.ok ? 100 : 70) : 0;
  return {
    score,
    verdict: correct && quality.ok ? "통과" : correct ? "보완" : "재작성",
    summary: correct
      ? quality.ok
        ? `${target.label}의 판별 단서를 정확히 봤습니다.`
        : `${target.label} 분류는 맞지만, 제시문은 첫후킹 품질 기준에서 보완이 필요합니다.`
      : `정답은 ${target.label}입니다. ${picked?.label || "선택지"}와 판별 단서가 다릅니다.`,
    checks: [
      { ok: correct, label: correct ? "정답입니다" : `정답: ${target.label}` },
      { ok: true, label: `정답 이유: ${target.definition || target.full || target.goal || target.hint}` },
      { ok: true, label: `판별 단서: ${targetTell}` },
      ...(question.kind === "chooseHook"
        ? quality.ok
          ? [{ ok: true, label: "첫후킹 품질: CTA보다 멈춤 문장에 가깝습니다" }]
          : quality.problems.map((problem) => ({ ok: false, label: problem }))
        : []),
      ...(correct ? [] : [{ ok: false, label: `${picked?.label || "선택"}의 단서: ${pickedTell}` }]),
    ],
    weaknesses: quality.ok ? [] : quality.problems,
    strengths: correct ? [`${target.label} 분류 단서를 찾았습니다.`] : [],
    model_answers: question.model_answers || target.examples || target.formulas || [target.template, target.full].filter(Boolean),
  };
}

async function gradeSubjective(question, answer, persona) {
  const modeMap = {
    writeHook: "hook",
    formulaFill: "hook",
    rewriteHook: "rewrite",
    writeStructure: "structure",
    writeAdPlan: "ad",
  };
  const mode = modeMap[question.kind] || "hook";
  const resp = await fetch("/api/hooking-grade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode,
      persona,
      target: question.target,
      questionType: question.questionType,
      rubric: question.rubric,
      answer,
    }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || "채점 실패");
  return data.result;
}

function toExamScore(score) {
  return Math.max(1, Math.min(10, Math.round(Number(score || 0) / 10)));
}

function makeExamRecord({ studentName, persona, history }) {
  const total = history.reduce((sum, item) => sum + item.score, 0);
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    studentName,
    total,
    maxTotal: 100,
    createdAt: new Date().toISOString(),
    persona: {
      brand: persona.brand,
      product: persona.product,
      audience: persona.audience,
      pain: persona.pain,
    },
    questions: history.map((item, index) => ({
      index: index + 1,
      questionType: item.questionType,
      targetKey: item.targetKey,
      targetGroup: item.targetGroup,
      title: item.title,
      prompt: item.prompt,
      guide: item.guide,
      example: item.example,
      answerText: item.answerText,
      targetLabel: item.targetLabel,
      score: item.score,
      rawScore: item.rawScore,
      max: item.max,
      summary: item.summary,
      weaknesses: item.weaknesses,
      strengths: item.strengths,
      coaching: item.coaching,
      checks: item.checks,
      rewrite: item.rewrite,
      model_answers: item.model_answers,
    })),
  };
}

export default function HookingPracticePage({ onBack, examMode = false }) {
  const [persona, setPersona] = useState(EMPTY_PERSONA);
  const [loadingPersona, setLoadingPersona] = useState(true);
  const [personaError, setPersonaError] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [selected, setSelected] = useState("");
  const [history, setHistory] = useState([]);
  const [result, setResult] = useState(null);
  const [grading, setGrading] = useState(false);
  const [gradeError, setGradeError] = useState("");
  const [studentName, setStudentName] = useState("");
  const [examStarted, setExamStarted] = useState(!examMode);
  const [examFinished, setExamFinished] = useState(false);
  const [examHistory, setExamHistory] = useState(() => loadExamHistory());
  const [expandedResultIndex, setExpandedResultIndex] = useState(null);
  const question = useMemo(() => buildBankQuestion(persona, questionIndex, examMode), [persona, questionIndex, examMode]);
  const isChoice = ["chooseStructure", "chooseHook", "diagnoseHook", "chooseFunnelStage", "chooseAdStructure"].includes(question.kind);
  const total = history.reduce((sum, item) => sum + item.score, 0);
  const maxTotal = examMode ? EXAM_QUESTION_COUNT * 10 : history.reduce((sum, item) => sum + item.max, 0);
  const percent = maxTotal ? Math.round((total / maxTotal) * 100) : 0;
  const resultPercent = result?.max ? Math.round((result.score / result.max) * 100) : 0;
  const pageTitle = examMode ? "실전 테스트" : "후킹끝구조끝";
  const pageDesc = examMode
    ? "응시자 이름을 남기고 10문제 실전 시험을 100점 만점으로 채점합니다"
    : "가상 광고주 페르소나를 보고 숏폼 후킹과 구조를 훈련합니다";
  const weakReport = useMemo(() => {
    const lowItems = history.filter((item) => (item.rawScore ?? item.score) < 70);
    const byType = {};
    const byTarget = {};
    const reasons = {};
    lowItems.forEach((item) => {
      if (item.questionType) byType[item.questionType] = (byType[item.questionType] || 0) + 1;
      if (item.targetLabel) byTarget[item.targetLabel] = (byTarget[item.targetLabel] || 0) + 1;
      (item.weaknesses || []).slice(0, 3).forEach((weakness) => {
        reasons[weakness] = (reasons[weakness] || 0) + 1;
      });
    });
    const top = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 4);
    return {
      count: lowItems.length,
      types: top(byType),
      targets: top(byTarget),
      reasons: top(reasons),
    };
  }, [history]);

  const resetPersona = async () => {
    setLoadingPersona(true);
    setPersonaError("");
    setQuestionIndex(0);
    setAnswer("");
    setSelected("");
    setResult(null);
    setGradeError("");
    setHistory([]);
    setExamFinished(false);
    setExpandedResultIndex(null);
    try {
      setPersona(await requestGeneratedPersona());
    } catch (e) {
      setPersonaError(e.message);
    } finally {
      setLoadingPersona(false);
    }
  };

  useEffect(() => {
    resetPersona();
  }, []);

  const startExam = async () => {
    if (!studentName.trim()) return;
    setExamStarted(true);
    await resetPersona();
  };

  const finishExam = (completedHistory) => {
    const record = makeExamRecord({
      studentName: studentName.trim(),
      persona,
      history: completedHistory,
    });
    const nextRecords = [record, ...examHistory];
    setExamHistory(nextRecords);
    saveExamHistory(nextRecords);
    setExamFinished(true);
  };

  const submit = async () => {
    const value = isChoice ? selected : answer;
    if (!value.trim()) return;
    setGrading(true);
    setGradeError("");
    try {
      const pickedOption = isChoice ? question.options.find((option) => option.key === value) : null;
      const graded = isChoice
        ? gradeChoice(question, value)
        : await gradeSubjective(question, value, persona);
      const rawScore = Number(graded.score || 0);
      const examScore = examMode ? toExamScore(rawScore) : rawScore;
      const next = {
        ...graded,
        score: examScore,
        rawScore,
        questionType: question.questionType,
        targetKey: question.target?.key,
        targetGroup: question.target?.group || question.target?.category || question.target?.awareness,
        title: question.title,
        prompt: question.prompt,
        guide: question.guide,
        example: question.example,
        answerText: isChoice
          ? `${pickedOption?.label || value}${pickedOption?.full || pickedOption?.hint ? ` - ${pickedOption.full || pickedOption.hint}` : ""}`
          : value,
        targetLabel: question.target?.label,
        weaknesses: graded.weaknesses,
        strengths: graded.strengths,
        max: examMode ? 10 : question.max,
      };
      setResult(next);
      setHistory((prev) => {
        const completed = [...prev, next];
        if (examMode && completed.length >= EXAM_QUESTION_COUNT) {
          finishExam(completed);
        }
        return completed;
      });
    } catch (e) {
      setGradeError(e.message);
    } finally {
      setGrading(false);
    }
  };

  const nextQuestion = () => {
    if (examMode && history.length >= EXAM_QUESTION_COUNT) {
      setExamFinished(true);
      return;
    }
    setQuestionIndex((prev) => prev + 1);
    setAnswer("");
    setSelected("");
    setResult(null);
    setGradeError("");
    setExpandedResultIndex(null);
  };

  const restartExam = () => {
    setExamStarted(false);
    setExamFinished(false);
    setStudentName("");
    setHistory([]);
    setQuestionIndex(0);
    setAnswer("");
    setSelected("");
    setResult(null);
    setGradeError("");
    setExpandedResultIndex(null);
  };

  if (examMode && !examStarted) {
    return (
      <div className="h-full min-h-0 overflow-y-auto bg-[#f5f6f8]">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200 bg-white/95 px-6 py-4 backdrop-blur">
          <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100" aria-label="뒤로가기">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-black tracking-tight text-gray-950">실전 테스트</h1>
            <p className="text-xs text-gray-500">10문제 · 문항별 10점 · 총 100점 만점</p>
          </div>
        </header>
        <main className="mx-auto grid max-w-5xl grid-cols-1 gap-5 px-6 py-8 lg:grid-cols-[1fr_380px]">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-500">Shortform Exam</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-gray-950">실전 응시 시작</h2>
            <p className="mt-3 text-sm leading-7 text-gray-600">
              하나의 가상 광고주 페르소나를 기준으로 엔진 판별, 구조 판별, 공식 빈칸, 후킹 작성, 약한 후킹 고치기,
              퍼널 단계, 광고 구조, 실전 광고 대본 문제가 섞여 출제됩니다.
            </p>
            <div className="mt-6">
              <label className="mb-2 block text-sm font-black text-gray-900">응시자 이름</label>
              <input
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") startExam();
                }}
                placeholder="예: 정대표"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 outline-none focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100"
              />
            </div>
            <button
              onClick={startExam}
              disabled={!studentName.trim() || loadingPersona}
              className="mt-5 rounded-xl bg-gray-950 px-6 py-3 text-sm font-black text-white hover:bg-black disabled:opacity-40"
            >
              {loadingPersona ? "페르소나 준비 중..." : "테스트 시작"}
            </button>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-black text-gray-900">응시 히스토리</h3>
            {examHistory.length === 0 ? (
              <p className="text-sm text-gray-400">아직 저장된 테스트가 없습니다.</p>
            ) : (
              <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
                {examHistory.map((record) => (
                  <div key={record.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-black text-gray-950">{record.studentName}</p>
                      <span className="rounded-full bg-gray-950 px-2.5 py-1 text-xs font-black text-white">{record.total}/100</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{new Date(record.createdAt).toLocaleString("ko-KR")}</p>
                    <p className="mt-2 text-xs font-bold leading-5 text-gray-600">{record.persona?.brand} · {record.persona?.product}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    );
  }

  if (examMode && examFinished) {
    return (
      <div className="h-full min-h-0 overflow-y-auto bg-[#f5f6f8]">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100" aria-label="뒤로가기">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-black tracking-tight text-gray-950">실전 테스트 결과</h1>
              <p className="text-xs text-gray-500">{studentName} · {persona.brand}</p>
            </div>
          </div>
          <button onClick={restartExam} className="rounded-lg bg-gray-950 px-4 py-2 text-sm font-black text-white hover:bg-black">새 응시</button>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8">
          <section className="rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-500">Final Score</p>
            <h2 className="mt-3 text-6xl font-black tracking-tight text-gray-950">{total}<span className="text-2xl text-gray-400"> / 100</span></h2>
            <p className="mt-3 text-sm font-bold text-gray-500">10문제 실전 테스트가 히스토리에 저장되었습니다.</p>
          </section>
          {weakReport.count > 0 && (
            <section className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
              <WeakReportCard title="약한 문제 유형" items={weakReport.types} empty="유형별 약점 없음" />
              <WeakReportCard title="약한 엔진/구조" items={weakReport.targets} empty="타겟별 약점 없음" />
              <WeakReportCard title="반복 감점 이유" items={weakReport.reasons} empty="반복 감점 없음" />
            </section>
          )}
          <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-black text-gray-900">문항별 점수</h3>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {history.map((item, index) => (
                <button
                  key={`${item.title}-${index}`}
                  type="button"
                  onClick={() => setExpandedResultIndex(expandedResultIndex === index ? null : index)}
                  className={`rounded-xl border p-3 text-left transition ${
                    expandedResultIndex === index
                      ? "border-orange-300 bg-orange-50"
                      : "border-gray-100 bg-gray-50 hover:border-gray-200 hover:bg-white"
                  }`}
                  aria-expanded={expandedResultIndex === index}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-black text-gray-900">{index + 1}. {item.title}</p>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-gray-950">{item.score}/10</span>
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`text-gray-400 transition-transform ${expandedResultIndex === index ? "rotate-180" : ""}`}
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </div>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-gray-600">{item.summary}</p>
                  {expandedResultIndex === index && (
                    <div className="mt-3 space-y-3 border-t border-orange-100 pt-3">
                      <ResultDetailBlock label="문제" value={item.prompt} />
                      {item.example && <ResultDetailBlock label="제시문" value={item.example} />}
                      {item.guide && <ResultDetailBlock label="가이드" value={item.guide} />}
                      {item.targetLabel && <ResultDetailBlock label="정답/목표" value={item.targetLabel} />}
                      <ResultDetailBlock label="내가 쓴 답" value={item.answerText || "저장된 답변이 없습니다."} tone="answer" />
                      {item.coaching?.length > 0 && (
                        <div className="rounded-xl border border-white bg-white/80 p-3">
                          <p className="mb-2 text-[11px] font-black text-gray-500">세부 피드백</p>
                          <div className="space-y-2">
                            {item.coaching.map((coach) => (
                              <div key={`${coach.item}-${coach.got}`} className="rounded-lg bg-gray-50 px-3 py-2">
                                <div className="mb-1 flex items-center justify-between gap-2">
                                  <p className="text-xs font-black text-gray-900">{coach.item}</p>
                                  <span className="text-[11px] font-black text-gray-500">{coach.got}/{coach.max}</span>
                                </div>
                                <p className="text-xs leading-5 text-gray-600">{coach.why}</p>
                                <p className="mt-1 text-xs leading-5 text-orange-700">{coach.how}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {item.checks?.length > 0 && (
                        <div className="rounded-xl border border-white bg-white/80 p-3">
                          <p className="mb-2 text-[11px] font-black text-gray-500">판별 근거</p>
                          <div className="space-y-1">
                            {item.checks.map((check) => (
                              <p key={check.label} className={`text-xs leading-5 ${check.ok ? "text-green-700" : "text-rose-700"}`}>
                                <span className="font-black">{check.ok ? "OK" : "MISS"}</span> {check.label}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                      {item.rewrite?.after && (
                        <ResultDetailBlock label="개선안" value={item.rewrite.after} tone="improve" />
                      )}
                      {item.model_answers?.length > 0 && (
                        <div className="rounded-xl border border-white bg-white/80 p-3">
                          <p className="mb-2 text-[11px] font-black text-gray-500">모범답안</p>
                          <div className="space-y-1">
                            {item.model_answers.map((modelAnswer, modelIndex) => (
                              <p key={`${modelAnswer}-${modelIndex}`} className="text-xs leading-5 text-gray-700">
                                {modelIndex + 1}. {modelAnswer}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-[#f5f6f8]">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white/95 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100" aria-label="뒤로가기">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-black tracking-tight text-gray-950">{pageTitle}</h1>
            <p className="text-xs text-gray-500">{pageDesc}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-right">
            <p className="text-[10px] font-bold text-gray-400">TOTAL SCORE</p>
            <p className="text-lg font-black text-gray-950">{total}<span className="text-xs text-gray-400"> / {maxTotal}</span></p>
          </div>
          {!examMode && (
            <button
              onClick={resetPersona}
              disabled={loadingPersona}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {loadingPersona ? "생성 중..." : "새 페르소나"}
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-5 px-6 py-6 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-4">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.15em] text-orange-500">Generated Advertiser</p>
                <h2 className="mt-1 text-2xl font-black text-gray-950">{persona.brand}</h2>
                <p className="text-sm text-gray-500">{persona.owner}</p>
              </div>
              <div className="rounded-xl bg-gray-950 px-3 py-2 text-center text-white">
                <p className="text-[10px] text-gray-400">점수율</p>
                <p className="text-lg font-black">{percent}%</p>
              </div>
            </div>
            <PersonaRow label="상품" value={persona.product} />
            <PersonaRow label="타겟" value={persona.audience} />
            <PersonaRow label="문제" value={persona.pain} />
            <PersonaRow label="욕구" value={persona.desire} />
            <PersonaRow label="저항" value={persona.objection} />
            {personaError && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                {personaError}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-black text-gray-900">누적 기록</h3>
            {history.length === 0 ? (
              <p className="text-sm text-gray-400">아직 제출한 답이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {history.map((item, index) => (
                  <div key={`${item.title}-${index}`} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs">
                    <span className="font-bold text-gray-700">{index + 1}. {item.title}</span>
                    <span className="font-black text-gray-950">{item.score}/{item.max}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>

        <section className="space-y-4">
          <div className="rounded-2xl border border-gray-900 bg-gray-950 p-5 text-white shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-300">Question {questionIndex + 1}{examMode ? ` / ${EXAM_QUESTION_COUNT}` : ""}</p>
                <h2 className="mt-1 text-2xl font-black">{question.title}</h2>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-gray-200">{examMode ? 10 : question.max}점</span>
            </div>
            <p className="text-base font-bold leading-7">{question.prompt}</p>
            {question.guide && <p className="mt-3 text-sm leading-6 text-gray-300">{question.guide}</p>}
          </div>

          {question.example && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
              <p className="mb-1 text-[11px] font-black text-orange-700">제시문</p>
              <p className="text-sm font-bold leading-7 text-gray-950">{question.example}</p>
            </div>
          )}

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            {isChoice ? (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {question.options.map((option) => (
                  <button
                    key={option.key}
                    onClick={() => setSelected(option.key)}
                    disabled={!!result}
                    className={`rounded-xl border p-4 text-left transition ${
                      selected === option.key
                        ? "border-orange-400 bg-orange-50"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    } ${result ? "cursor-default" : ""}`}
                  >
                    <p className="font-black text-gray-950">{option.label}</p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">{option.full || option.hint || option.goal || option.awareness}</p>
                  </button>
                ))}
              </div>
            ) : (
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={!!result}
                rows={8}
                placeholder="여기에 답을 작성하세요."
                className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-7 text-gray-900 outline-none focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100 disabled:opacity-70"
              />
            )}

            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-400">주관식은 후킹성, 페르소나 반영, 구조 정확도 기준으로 즉시 채점됩니다.</p>
              {!result ? (
                <button
                  onClick={submit}
                  disabled={grading}
                  className="rounded-lg bg-gray-950 px-5 py-2 text-sm font-black text-white hover:bg-black disabled:opacity-50"
                >
                  {grading ? "채점 중..." : "제출"}
                </button>
              ) : (
                <button onClick={nextQuestion} className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-black text-white hover:bg-orange-600">
                  {examMode && history.length >= EXAM_QUESTION_COUNT ? "결과 보기" : "다음 문제"}
                </button>
              )}
            </div>
            {gradeError && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                {gradeError}
              </div>
            )}
          </div>

          {result && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-black text-gray-950">채점 결과</h3>
                <span className={`rounded-full px-3 py-1 text-sm font-black ${
                  resultPercent >= 80 ? "bg-green-100 text-green-700" : resultPercent >= 60 ? "bg-yellow-100 text-yellow-700" : "bg-rose-100 text-rose-700"
                }`}>
                  {result.score}/{result.max}
                </span>
              </div>
              <p className="mb-4 text-sm leading-7 text-gray-700">{result.summary || result.feedback}</p>
              {result.coaching?.length > 0 && (
                <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {result.coaching.map((item) => (
                    <div key={item.item} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-black text-gray-900">{item.item}</p>
                        <span className="text-xs font-black text-gray-500">{item.got}/{item.max}</span>
                      </div>
                      <p className="text-xs leading-5 text-gray-600"><strong>왜:</strong> {item.why}</p>
                      <p className="mt-1 text-xs leading-5 text-orange-700"><strong>개선:</strong> {item.how}</p>
                    </div>
                  ))}
                </div>
              )}
              {result.checks?.length > 0 && (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {result.checks.map((check) => (
                    <div key={check.label} className={`rounded-lg border px-3 py-2 text-sm ${
                      check.ok ? "border-green-200 bg-green-50 text-green-800" : "border-rose-200 bg-rose-50 text-rose-800"
                    }`}>
                      <span className="font-black">{check.ok ? "OK" : "MISS"}</span> {check.label}
                    </div>
                  ))}
                </div>
              )}
              {result.rewrite && (
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <p className="mb-2 text-[11px] font-black text-gray-500">Before</p>
                    <p className="text-sm leading-7 text-gray-700">{result.rewrite.before}</p>
                  </div>
                  <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                    <p className="mb-2 text-[11px] font-black text-orange-700">After</p>
                    <p className="text-sm font-bold leading-7 text-gray-950">{result.rewrite.after}</p>
                    <p className="mt-2 text-xs leading-5 text-orange-700">{result.rewrite.changed}</p>
                  </div>
                </div>
              )}
              {result.model_answers?.length > 0 && (
                <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
                  <p className="mb-2 text-sm font-black text-gray-900">모범답안</p>
                  <div className="space-y-2">
                    {result.model_answers.map((item, index) => (
                      <p key={`${item}-${index}`} className="rounded-lg bg-gray-50 px-3 py-2 text-sm leading-6 text-gray-700">
                        {index + 1}. {item}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function PersonaRow({ label, value }) {
  return (
    <div className="mb-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
      <p className="text-[10px] font-black text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-6 text-gray-800">{value}</p>
    </div>
  );
}

function ResultDetailBlock({ label, value, tone = "default" }) {
  const toneClass = {
    default: "bg-white/80 text-gray-700",
    answer: "bg-gray-950 text-white",
    improve: "bg-white text-orange-800",
  }[tone];

  return (
    <div className={`rounded-xl border border-white p-3 ${toneClass}`}>
      <p className={`mb-1 text-[11px] font-black ${tone === "answer" ? "text-gray-300" : "text-gray-500"}`}>{label}</p>
      <p className="whitespace-pre-wrap text-xs leading-5">{value}</p>
    </div>
  );
}

function WeakReportCard({ title, items, empty }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm font-black text-gray-900">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400">{empty}</p>
      ) : (
        <div className="space-y-2">
          {items.map(([label, count]) => (
            <div key={label} className="flex items-start justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2">
              <p className="text-xs font-bold leading-5 text-gray-700">{label}</p>
              <span className="rounded-full bg-gray-950 px-2 py-0.5 text-[11px] font-black text-white">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
