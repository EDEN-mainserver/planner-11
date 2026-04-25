// 커뮤니티 썰 변환 API — OpenAI GPT 사용
// POST /api/convert-script  Body: { text }
// Returns: { title, text }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return res.status(500).json({ error: 'OpenAI API 키가 설정되지 않았습니다.' });
  }

  const { text: rawText } = req.body;
  if (!rawText) {
    return res.status(400).json({ error: '변환할 텍스트가 없습니다.' });
  }

  const systemPrompt = `당신은 커뮤니티 게시판(디씨인사이드, 에펨코리아 등) 스타일의 썰 작가입니다.
주어진 SNS 게시물을 바탕으로 커뮤니티 스타일 썰 스크립트를 작성해주세요.

규칙:
- 제목: 클릭을 유도하는 커뮤니티 스타일 제목 (15~25자, 짧고 궁금증 유발)
- 스크립트: 1인칭 구어체, 짧은 문장으로 리듬감, 줄바꿈으로 호흡 조절
- 길이: 10~15문장 (너무 길지 않게)
- 말투: "~거든", "~잖아", "~인데", "~였어" 등 자연스러운 구어체
- 반드시 JSON만 응답 (다른 설명 없이): {"title": "제목", "text": "스크립트"}`;

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.8,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `다음 SNS 게시물을 커뮤니티 썰 스크립트로 변환해줘:\n\n${rawText}` },
        ],
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      return res.status(resp.status).json({ error: err.error?.message || `OpenAI 오류 ${resp.status}` });
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '';
    const result = JSON.parse(content);

    if (!result.title || !result.text) {
      return res.status(500).json({ error: '응답 형식 오류' });
    }

    return res.status(200).json({ title: result.title, text: result.text });
  } catch (err) {
    return res.status(500).json({ error: err.message || '변환 중 오류 발생' });
  }
}
