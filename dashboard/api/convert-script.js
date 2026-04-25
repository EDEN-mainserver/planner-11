// 커뮤니티 썰 변환 API — Anthropic Claude 우선, OpenAI 폴백
// POST /api/convert-script  Body: { text }
// Returns: { title, text }

const SYSTEM_PROMPT = `당신은 커뮤니티 게시판(디씨인사이드, 에펨코리아 등) 스타일의 썰 작가입니다.
주어진 SNS 게시물을 바탕으로 커뮤니티 스타일 썰 스크립트를 작성해주세요.

규칙:
- 제목: 클릭을 유도하는 커뮤니티 스타일 제목 (15~25자, 짧고 궁금증 유발)
- 스크립트: 1인칭 구어체, 짧은 문장으로 리듬감, 줄바꿈으로 호흡 조절
- 길이: 10~15문장 (너무 길지 않게)
- 말투: "~거든", "~잖아", "~인데", "~였어" 등 자연스러운 구어체
- 반드시 JSON만 응답 (다른 설명 없이): {"title": "제목", "text": "스크립트"}`;

async function callClaude(rawText, apiKey) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `다음 SNS 게시물을 커뮤니티 썰 스크립트로 변환해줘:\n\n${rawText}` }],
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `Claude 오류 ${resp.status}`);
  }
  const data = await resp.json();
  const content = data.content?.[0]?.text || '';
  const match = content.match(/\{[\s\S]*?"title"[\s\S]*?"text"[\s\S]*?\}/);
  if (!match) throw new Error('응답 파싱 실패');
  return JSON.parse(match[0]);
}

async function callOpenAI(rawText, apiKey) {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.8,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `다음 SNS 게시물을 커뮤니티 썰 스크립트로 변환해줘:\n\n${rawText}` },
      ],
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI 오류 ${resp.status}`);
  }
  const data = await resp.json();
  const result = JSON.parse(data.choices?.[0]?.message?.content || '{}');
  if (!result.title || !result.text) throw new Error('응답 형식 오류');
  return result;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { text: rawText } = req.body;
  if (!rawText) {
    return res.status(400).json({ error: '변환할 텍스트가 없습니다.' });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey    = process.env.OPENAI_API_KEY;

  // 1차: Claude
  if (anthropicKey) {
    try {
      const result = await callClaude(rawText, anthropicKey);
      return res.status(200).json(result);
    } catch (err) {
      console.error('[convert-script] Claude 실패:', err.message);
    }
  }

  // 2차: OpenAI
  if (openaiKey) {
    try {
      const result = await callOpenAI(rawText, openaiKey);
      return res.status(200).json(result);
    } catch (err) {
      console.error('[convert-script] OpenAI 실패:', err.message);
      return res.status(500).json({ error: 'OpenAI 실패: ' + err.message });
    }
  }

  return res.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });
}
