// 풀그래픽 영상 플랜 생성 API
// POST /api/fullgraphic-plan
// Body: { topic, sourceUrl, prompt, motionDesc, style }
// Returns: { beats: [...] }

const SYSTEM_PROMPT = `당신은 숏폼 영상 기획 전문가입니다.
주어진 정보를 바탕으로 세로형(9:16) 숏폼 영상의 타임라인 플랜(beats)을 생성하세요.

규칙:
- beats는 5~8개 사이
- 각 beat는 3~7초 길이 (전체 30~60초 분량)
- time 형식: "0:00–0:05" (시작–끝, 분:초)
- label: 해당 구간의 짧은 이름 (10자 이내)
- desc: 실제 모션 그래픽 설명 (어떤 애니메이션, 텍스트, 효과인지 구체적으로)
  - 예: "검은 배경 + 크롬 그라디언트 타이틀 whip-pan 등장"
  - 예: "핵심 키워드 왼쪽 슬라이드인, 배경 그리드 오버레이"
  - 예: "Instagram / YouTube 팔로우 카드 슬라이드인"
  - 예: "로고 페이드아웃, CTA 버튼 펄스, 6초 홀드"
- 반드시 JSON 배열만 응답 (다른 설명 없이):
[
  {"id":1,"time":"0:00–0:05","label":"오프닝","desc":"...","keep":true},
  ...
]`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { topic, sourceUrl, prompt, motionDesc, style } = req.body || {};

  const parts = [];
  if (topic)      parts.push(`주제: ${topic}`);
  if (sourceUrl)  parts.push(`참고 URL: ${sourceUrl}`);
  if (prompt)     parts.push(`요청 사항:\n${prompt}`);
  if (motionDesc) parts.push(`모션 설명:\n${motionDesc}`);
  if (style)      parts.push(`영상 스타일: ${style}`);

  if (parts.length === 0) {
    return res.status(400).json({ error: "입력 정보가 없습니다." });
  }

  const userContent = parts.join("\n\n");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY 환경변수가 없습니다." });
  }

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `다음 정보를 바탕으로 숏폼 영상 타임라인 플랜을 생성해줘:\n\n${userContent}`,
          },
        ],
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || `Claude API 오류 ${resp.status}`);
    }

    const data = await resp.json();
    const text = data.content?.[0]?.text || "";

    // JSON 배열 추출
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("응답 파싱 실패");

    const beats = JSON.parse(match[0]);

    // id/keep 보정
    const normalized = beats.map((b, i) => ({
      id:    b.id ?? i + 1,
      time:  b.time  || "",
      label: b.label || `구간 ${i + 1}`,
      desc:  b.desc  || "",
      keep:  b.keep  !== false,
    }));

    return res.status(200).json({ beats: normalized });
  } catch (err) {
    console.error("[fullgraphic-plan] 오류:", err);
    return res.status(500).json({ error: err.message || "플랜 생성 실패" });
  }
}
