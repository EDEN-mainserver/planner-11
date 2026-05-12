import { callGemini, generateImage } from "../../utils/gemini";

export async function generateOneImage(prompt) {
  return generateImage(`${prompt}, no text, no watermark, photorealistic, high quality`, "3:4");
}

export async function analyzeDesignToTemplate(base64, mimeType) {
  const raw = await callGemini(
    [
      {
        role: "user",
        content: `첨부한 카드뉴스 디자인 이미지를 분석해서, 이 디자인을 그대로 재현하는 HTML+CSS 카드 템플릿을 만들어주세요.

조건:
- 카드 1장 크기: width 1080px, height 1350px
- 배경색, 텍스트 색상, 레이아웃, 폰트 크기, 여백, 시각 구성요소를 최대한 동일하게 재현
- 텍스트 내용은 다음 플레이스홀더로 대체 (이 문자열이 그대로 HTML에 삽입됨):
  CARD_NUM → 슬라이드 번호 (예: 01, 02)
  CARD_HEADLINE → 메인 제목
  CARD_BODY → 본문 텍스트
  CARD_BRAND → 브랜드명
- 배경 이미지가 있는 경우 CARD_IMAGE_URL 플레이스홀더 사용 (없으면 배경색/그라디언트 유지)
- 외부 CDN/폰트 없이 standalone
- <style> 태그와 <div class="card"> 블록만 반환 (<html>/<body> 태그 없음)

반드시 \`\`\`html 코드블록으로만 반환하세요.`,
        inlineImages: [{ mimeType, base64 }],
      },
    ],
    "카드뉴스 디자인 분석 및 HTML 재현 전문가. 이미지에서 정확한 디자인을 추출합니다."
  );
  const match = raw.match(/```html\n?([\s\S]+?)```/);
  return match ? match[1].trim() : raw.trim();
}
