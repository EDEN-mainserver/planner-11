"""GPT 기반 콘텐츠 생성 서비스 — 제목, 태그, 설명글, 후킹 스크립트"""
import json

from app.core.config import settings


class ContentGenerator:
    """쇼츠 메타데이터 자동 생성"""

    def __init__(self):
        self._client = None

    @property
    def client(self):
        if self._client is None:
            from openai import OpenAI
            self._client = OpenAI(api_key=settings.openai_api_key)
        return self._client

    async def generate_metadata(self, clip_text: str, hook_text: str = "") -> dict:
        """
        클립 자막 텍스트로 쇼츠 메타데이터 생성.

        Returns:
            {
                "title": str,           # 쇼츠 제목
                "description": str,     # 설명글
                "hashtags": [str],      # 해시태그 목록
                "category": str,        # 카테고리
            }
        """
        prompt = f"""다음 쇼츠 영상의 자막 내용을 보고, 유튜브 쇼츠에 최적화된 메타데이터를 생성해주세요.

## 자막 내용
{clip_text}

## 출력 형식 (JSON)
{{
    "title": "유튜브 쇼츠 제목 (한국어, 50자 이내, 클릭 유도형)",
    "description": "쇼츠 설명글 (한국어, 200자 이내, 관련 키워드 포함)",
    "hashtags": ["#태그1", "#태그2", "#태그3", "#태그4", "#태그5"],
    "category": "Entertainment/Education/HowTo/News 중 택 1"
}}"""

        response = self.client.chat.completions.create(
            model=settings.openai_model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.8,
        )

        return json.loads(response.choices[0].message.content)

    async def generate_hook_voice_script(self, clip_text: str) -> str:
        """
        클립 앞에 삽입할 후킹 나레이션 스크립트 생성 (3초 이내).
        """
        prompt = f"""다음 영상 클립의 자막을 보고, 시청자의 주의를 끌 수 있는
후킹 나레이션 한 문장을 만들어주세요.

규칙:
- 한국어, 15자 이내
- 읽는 데 3초 이내
- 호기심/놀람을 유발
- 큰따옴표 없이 텍스트만 반환

자막:
{clip_text[:500]}"""

        response = self.client.chat.completions.create(
            model=settings.openai_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.9,
        )

        return response.choices[0].message.content.strip().strip('"')

    async def generate_tts_audio(self, text: str, output_path: str) -> str:
        """
        TTS로 후킹 나레이션 음성 파일 생성.

        Returns: 생성된 음성 파일 경로
        """
        response = self.client.audio.speech.create(
            model=settings.tts_model,
            voice=settings.tts_voice,
            input=text,
            speed=1.1,
        )

        response.stream_to_file(output_path)
        return output_path


content_generator = ContentGenerator()
