// PDF 템플릿 분석 API
// PDF를 Gemini Vision에 전달해 디자인 스타일(색상/레이아웃/구조)을 추출한다

const ANALYSIS_PROMPT = `
이 PDF는 마케팅 서비스 제안서입니다.
디자인 스타일과 슬라이드 구조를 분석해서 아래 JSON만 반환해 주세요. 설명 없이 JSON만.

{
  "slideCount": 전체 슬라이드 수 (숫자),
  "primaryColor": "메인 컬러 hex (예: #1B3A7A)",
  "accentColor": "강조 컬러 hex (예: #F4A300)",
  "backgroundColor": "배경 컬러 hex (예: #FFFFFF)",
  "titleColor": "제목 텍스트 컬러 hex",
  "fontStyle": "폰트 계열 설명 (예: 고딕 sans-serif, 명조 serif)",
  "layoutStyle": "레이아웃 패턴 (예: 좌측 타이틀+우측 여백, 풀블리드 배경, 심플 중앙정렬)",
  "sectionStructure": ["섹션명1", "섹션명2"],
  "designKeywords": ["키워드1", "키워드2", "키워드3"],
  "contentDensity": "sparse 또는 normal 또는 dense",
  "styleDescription": "전체 디자인 스타일 한 줄 요약 (한국어)"
}
`.trim();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) {
    return res.status(500).json({ error: 'Gemini API 키가 서버에 설정되지 않았습니다.' });
  }

  const { pdfBase64 } = req.body;
  if (!pdfBase64) {
    return res.status(400).json({ error: 'PDF 데이터가 없습니다.' });
  }

  // PDF 크기 체크 (base64 기준 ~4MB = 원본 ~3MB)
  if (pdfBase64.length > 4 * 1024 * 1024) {
    return res.status(400).json({ error: 'PDF 파일이 너무 큽니다 (최대 3MB).' });
  }

  const body = {
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
        { text: ANALYSIS_PROMPT }
      ]
    }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
  };

  // gemini-2.5-pro: PDF 네이티브 지원
  const models = ['gemini-2.5-pro', 'gemini-2.5-flash'];

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!resp.ok) {
        const err = await resp.json();
        if (resp.status !== 503 && resp.status !== 429) {
          return res.status(resp.status).json({ error: err.error?.message || 'Gemini 오류' });
        }
        continue;
      }

      const data = await resp.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // JSON 추출 (```json ... ``` 또는 { ... })
      const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/(\{[\s\S]*\})/);
      if (!jsonMatch) {
        return res.status(500).json({ error: 'JSON 파싱 실패', raw: text });
      }

      const template = JSON.parse(jsonMatch[1].trim());
      return res.status(200).json({ template });

    } catch (e) {
      if (models.indexOf(model) === models.length - 1) {
        return res.status(500).json({ error: e.message });
      }
    }
  }

  return res.status(503).json({ error: '모든 모델 실패' });
}
