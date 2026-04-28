import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });

function buildPrompt(
  subtitleText: string,
  numClips: number,
  customPrompt: string,
  clipDuration: number
) {
  return `당신은 숏폼 영상 전문 편집자입니다.
긴 영상의 자막을 분석하여, 숏폼(${clipDuration}초 이내)으로 만들기 좋은 구간을 추천해야 합니다.

추천 기준:
1. 독립적으로 의미가 통하는 완결된 이야기/주제
2. 강한 감정(웃김, 놀라움, 감동, 공감)을 유발하는 구간
3. 핵심 정보나 인사이트가 담긴 구간
4. 논쟁적이거나 호기심을 자극하는 발언
5. 시작과 끝이 자연스러운 구간

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요:
[
  {
    "title": "클립 제목 (숏폼 제목으로 적합한)",
    "start_time": "HH:MM:SS,mmm",
    "end_time": "HH:MM:SS,mmm",
    "reason": "선정 이유 (한 줄)",
    "hook": "추천 훅 멘트 (시청자를 끌어들일 첫 문장)",
    "virality_score": 8,
    "category": "funny|insight|emotional|controversial|informative"
  }
]

다음 자막에서 숏폼으로 만들기 좋은 구간을 ${numClips}개 추천해주세요.
${customPrompt ? `추가 요청: ${customPrompt}` : ""}

자막:
${subtitleText}`;
}

function extractJson(text: string) {
  if (text.includes("```json")) {
    return text.split("```json")[1].split("```")[0].trim();
  }
  if (text.includes("```")) {
    return text.split("```")[1].split("```")[0].trim();
  }
  return text.trim();
}

async function analyzeWithGemini(prompt: string) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const result = await model.generateContent(prompt);
  return JSON.parse(extractJson(result.response.text()));
}

async function analyzeWithClaude(prompt: string) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  return JSON.parse(extractJson(text));
}

function fallbackAnalyze(subtitleText: string, numClips: number, clipDuration: number) {
  const lines = subtitleText.trim().split("\n");
  const timePattern = /\[(\d{2}:\d{2}:\d{2})[,.\d]* --> (\d{2}:\d{2}:\d{2})[,.\d]*\]\s*(.*)/;
  const parsedLines = lines
    .map((line) => line.match(timePattern))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      start: match[1],
      end: match[2],
      text: match[3],
    }));

  if (parsedLines.length === 0) {
    return [];
  }

  const viralKeywords: Record<string, string[]> = {
    emotional: ["울", "눈물", "힘들", "슬프", "미안", "고마", "사랑", "그리", "아프", "죽"],
    funny: ["ㅋㅋ", "웃", "미친", "대박", "헐", "장난", "개그", "빵"],
    controversial: ["논란", "싸움", "디스", "욕", "시발", "씨발", "존나", "대마", "합법"],
    insight: ["깨달", "배우", "인생", "성장", "변화", "중요", "진짜", "핵심"],
    informative: ["방법", "이유", "비결", "노하우", "팁", "전략"],
  };

  const timeToSeconds = (time: string) => {
    const [h, m, s] = time.split(":");
    return Number(h) * 3600 + Number(m) * 60 + Number(s.split(",")[0].split(".")[0]);
  };

  const secondsToTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},000`;
  };

  const step = Math.max(10, Math.floor(clipDuration / 2));
  const minTexts = Math.max(3, Math.floor(clipDuration / 10));
  const maxTime = timeToSeconds(parsedLines[parsedLines.length - 1].end);
  const candidates: Array<{
    start: string;
    end: string;
    texts: string[];
    score: number;
    category: string;
  }> = [];

  for (let startSec = 0; startSec < maxTime - 10; startSec += step) {
    const endSec = startSec + clipDuration;
    const windowTexts: string[] = [];
    let actualStart: string | null = null;
    let actualEnd: string | null = null;

    for (const line of parsedLines) {
      const lineStart = timeToSeconds(line.start);
      if (lineStart >= startSec && lineStart < endSec) {
        windowTexts.push(line.text);
        actualStart ??= line.start;
        actualEnd = line.end;
      }
    }

    if (!actualStart || !actualEnd || windowTexts.length < minTexts) {
      continue;
    }

    if (timeToSeconds(actualEnd) - timeToSeconds(actualStart) > clipDuration) {
      actualEnd = secondsToTime(timeToSeconds(actualStart) + clipDuration);
    }

    const combined = windowTexts.join(" ");
    let score = windowTexts.length * 0.3;
    let category = "informative";
    let maxCategoryScore = 0;

    for (const [candidateCategory, keywords] of Object.entries(viralKeywords)) {
      const categoryScore = keywords.filter((keyword) => combined.includes(keyword)).length;
      score += categoryScore;

      if (categoryScore > maxCategoryScore) {
        maxCategoryScore = categoryScore;
        category = candidateCategory;
      }
    }

    candidates.push({
      start: actualStart,
      end: actualEnd,
      texts: windowTexts.slice(0, 3),
      score,
      category,
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  const selected: typeof candidates = [];
  const usedRanges: Array<[number, number]> = [];

  for (const candidate of candidates) {
    const start = timeToSeconds(candidate.start);
    const end = timeToSeconds(candidate.end);
    const overlaps = usedRanges.some(([usedStart, usedEnd]) => start < usedEnd && end > usedStart);

    if (overlaps) {
      continue;
    }

    selected.push(candidate);
    usedRanges.push([start, end]);

    if (selected.length >= numClips) {
      break;
    }
  }

  return selected.map((clip, index) => {
    const title = clip.texts.join(" ").slice(0, 30) || `하이라이트 ${index + 1}`;
    const hook = clip.texts[0] || title;
    const viralityScore = Math.min(10, Math.max(5, Math.floor(clip.score)));

    return {
      title,
      start_time: clip.start.includes(",") ? clip.start : `${clip.start},000`,
      end_time: clip.end.includes(",") ? clip.end : `${clip.end},000`,
      reason: `감정/바이럴 키워드 밀도가 높은 구간 (점수: ${clip.score.toFixed(1)})`,
      hook,
      virality_score: viralityScore,
      category: clip.category,
    };
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subtitleText, numClips = 5, customPrompt = "", clipDuration = 60 } = body;

    if (!subtitleText) {
      return NextResponse.json({ error: "자막 텍스트가 필요합니다." }, { status: 400 });
    }

    const prompt = buildPrompt(subtitleText, numClips, customPrompt, clipDuration);

    let clips;
    try {
      clips = await analyzeWithGemini(prompt);
    } catch (error) {
      const message = String(error);
      const shouldFallback =
        message.includes("429") ||
        message.includes("Resource exhausted") ||
        message.includes("fetch failed");

      if (!shouldFallback) {
        throw error;
      }

      try {
        if (!process.env.ANTHROPIC_API_KEY) {
          throw new Error("Anthropic API key is missing.");
        }
        clips = await analyzeWithClaude(prompt);
      } catch (fallbackError) {
        console.error("Claude fallback failed:", fallbackError);
        clips = fallbackAnalyze(subtitleText, numClips, clipDuration);
      }
    }

    return NextResponse.json({ clips });
  } catch (error) {
    console.error("Analyze error:", error);
    return NextResponse.json(
      { error: "AI 분석 중 오류가 발생했습니다.", detail: String(error) },
      { status: 500 }
    );
  }
}
