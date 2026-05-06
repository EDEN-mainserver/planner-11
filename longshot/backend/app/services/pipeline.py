"""쇼츠 생성 파이프라인 — 전체 워크플로우 오케스트레이터"""
import uuid
import logging
from pathlib import Path

from app.core.config import settings
from app.services.video.downloader import downloader
from app.services.video.processor import video_processor
from app.services.video.subtitle_renderer import subtitle_renderer
from app.services.ai.transcriber import transcriber
from app.services.ai.highlight_detector import highlight_detector
from app.services.ai.content_generator import content_generator

logger = logging.getLogger(__name__)


class ShortsGenerationPipeline:
    """
    전체 쇼츠 생성 파이프라인.

    워크플로우:
    1. 영상 다운로드 (YouTube) 또는 업로드 파일 사용
    2. Whisper 자막 생성
    3. GPT 하이라이트 감지
    4. 클립 추출 + 세로 변환
    5. 자막 임베딩
    6. (선택) 무음 제거
    7. (선택) 후킹 보이스 삽입
    8. 메타데이터 생성 (제목, 태그, 설명)
    9. 썸네일 생성
    """

    async def run(
        self,
        project_id: str,
        source_type: str,
        youtube_url: str | None = None,
        uploaded_file_path: str | None = None,
        options: dict | None = None,
    ) -> dict:
        """
        파이프라인 실행.

        Args:
            project_id: 프로젝트 ID
            source_type: "youtube" | "upload"
            youtube_url: 유튜브 URL (source_type이 youtube일 때)
            uploaded_file_path: 업로드된 파일 경로 (source_type이 upload일 때)
            options: {
                "remove_silence": bool,     # 무음 제거
                "add_hook_voice": bool,     # 후킹 보이스
                "subtitle_style": str,      # "karaoke" | "highlight" | "simple"
                "language": str,            # 자막 언어 (기본 "ko")
            }

        Returns:
            {
                "project_id": str,
                "source": { ... },
                "shorts": [
                    {
                        "id": str,
                        "video_path": str,
                        "thumbnail_path": str,
                        "highlight": { ... },
                        "subtitles": { ... },
                        "metadata": { ... },
                    }
                ]
            }
        """
        opts = options or {}
        remove_silence = opts.get("remove_silence", False)
        add_hook_voice = opts.get("add_hook_voice", False)
        subtitle_style = opts.get("subtitle_style", "karaoke")
        language = opts.get("language", "ko")
        subtitle_source = opts.get("subtitle_source", "whisper")
        external_segments = opts.get("subtitle_segments")  # youtube_auto / srt 에서 전달된 세그먼트

        output_dir = Path(settings.output_dir) / project_id
        output_dir.mkdir(parents=True, exist_ok=True)

        # --- 1. 소스 영상 확보 ---
        logger.info(f"[{project_id}] 1단계: 영상 확보")
        if source_type == "youtube" and youtube_url:
            source_info = await downloader.download(youtube_url, project_id)
            source_path = source_info["file_path"]
        elif uploaded_file_path:
            source_path = uploaded_file_path
            video_info = await downloader.get_video_info(source_path)
            source_info = {
                "file_path": source_path,
                "title": Path(source_path).stem,
                "duration": video_info["duration"],
            }
        else:
            raise ValueError("youtube_url 또는 uploaded_file_path 필요")

        total_duration = source_info.get("duration", 0)
        logger.info(f"[{project_id}] 소스 확보 완료: {total_duration}초")

        # --- 2. 자막 생성 (외부 세그먼트 우선, 없으면 Whisper) ---
        logger.info(f"[{project_id}] 2단계: 자막 생성 (소스: {subtitle_source})")
        if subtitle_source != "whisper" and external_segments:
            # youtube_auto 또는 srt — 외부 세그먼트를 words 포맷으로 변환
            words = [
                {"start": s["start"], "end": s["end"], "word": s["text"]}
                for s in external_segments
            ]
            transcript = {
                "text": " ".join(s["text"] for s in external_segments),
                "segments": external_segments,
                "words": words,
            }
            logger.info(f"[{project_id}] 외부 자막 사용: {len(external_segments)}개 세그먼트")
        elif subtitle_source == "none":
            transcript = {"text": "", "segments": [], "words": []}
            logger.info(f"[{project_id}] 자막 없음 모드")
        else:
            transcript = await transcriber.transcribe(source_path, language)
            logger.info(f"[{project_id}] Whisper 전사 완료: {len(transcript['segments'])}개 세그먼트")

        # --- 3. GPT 하이라이트 감지 ---
        logger.info(f"[{project_id}] 3단계: 하이라이트 감지")
        highlights = await highlight_detector.detect(
            transcript["segments"], total_duration
        )
        logger.info(f"[{project_id}] 하이라이트 {len(highlights)}개 감지")

        # --- 4~8. 각 하이라이트별 쇼츠 생성 ---
        shorts_results = []
        for i, highlight in enumerate(highlights):
            short_id = f"short_{uuid.uuid4().hex[:8]}"
            short_dir = output_dir / short_id
            short_dir.mkdir(exist_ok=True)

            logger.info(
                f"[{project_id}] 쇼츠 {i + 1}/{len(highlights)}: "
                f"{highlight['start']:.1f}s ~ {highlight['end']:.1f}s"
            )

            try:
                result = await self._process_single_short(
                    source_path=source_path,
                    highlight=highlight,
                    short_id=short_id,
                    short_dir=short_dir,
                    transcript=transcript,
                    remove_silence=remove_silence,
                    add_hook_voice=add_hook_voice,
                    subtitle_style=subtitle_style,
                    language=language,
                )
                shorts_results.append(result)
            except Exception as e:
                logger.error(f"[{project_id}] 쇼츠 {short_id} 생성 실패: {e}")
                shorts_results.append({
                    "id": short_id,
                    "status": "error",
                    "error": str(e),
                    "highlight": highlight,
                })

        return {
            "project_id": project_id,
            "source": source_info,
            "shorts": shorts_results,
        }

    async def _process_single_short(
        self,
        source_path: str,
        highlight: dict,
        short_id: str,
        short_dir: Path,
        transcript: dict,
        remove_silence: bool,
        add_hook_voice: bool,
        subtitle_style: str,
        language: str,
    ) -> dict:
        """개별 쇼츠 1개 처리"""
        start = highlight["start"]
        end = highlight["end"]

        # 4a. 클립 추출
        clip_path = str(short_dir / "clip_raw.mp4")
        await video_processor.extract_clip(source_path, start, end, clip_path)

        # 4b. 세로 변환 (9:16)
        vertical_path = str(short_dir / "clip_vertical.mp4")
        await video_processor.convert_to_vertical(clip_path, vertical_path)

        current_path = vertical_path

        # 5. (선택) 무음 제거
        if remove_silence:
            desilenced_path = str(short_dir / "clip_desilenced.mp4")
            await video_processor.remove_silence(current_path, desilenced_path)
            current_path = desilenced_path

        # 6. 자막 생성 + 임베딩
        clip_words = self._filter_words(transcript["words"], start, end)
        if clip_words:
            ass_path = str(short_dir / "subtitles.ass")
            subtitle_renderer.generate_ass(clip_words, ass_path, style=subtitle_style)

            subtitled_path = str(short_dir / "clip_subtitled.mp4")
            await video_processor.add_subtitles(current_path, ass_path, subtitled_path)
            current_path = subtitled_path

        # 7. (선택) 후킹 보이스
        hook_audio_path = None
        hook_script = ""
        if add_hook_voice:
            clip_text = " ".join(w["word"] for w in clip_words)
            hook_script = await content_generator.generate_hook_voice_script(clip_text)

            hook_audio_path = str(short_dir / "hook_voice.mp3")
            await content_generator.generate_tts_audio(hook_script, hook_audio_path)

            hooked_path = str(short_dir / "clip_hooked.mp4")
            hook_text = highlight.get("hook_text", hook_script)
            await video_processor.prepend_hook_audio(
                current_path, hook_audio_path, hook_text, hooked_path
            )
            current_path = hooked_path

        # 최종 파일 이름 정리
        final_path = str(short_dir / "final.mp4")
        if current_path != final_path:
            Path(current_path).rename(final_path)

        # 8. 메타데이터 생성
        clip_text = " ".join(w["word"] for w in clip_words)
        metadata = await content_generator.generate_metadata(clip_text)

        # 9. 썸네일
        thumb_path = str(short_dir / "thumbnail.jpg")
        await video_processor.generate_thumbnail(final_path, thumb_path)

        return {
            "id": short_id,
            "status": "completed",
            "video_path": final_path,
            "thumbnail_path": thumb_path,
            "highlight": highlight,
            "subtitles": {
                "word_count": len(clip_words),
                "style": subtitle_style,
            },
            "metadata": metadata,
            "hook": {
                "enabled": add_hook_voice,
                "script": hook_script,
            },
        }

    @staticmethod
    def _filter_words(words: list[dict], start: float, end: float) -> list[dict]:
        """전체 단어 목록에서 클립 구간에 해당하는 단어만 필터링 + 오프셋 조정"""
        filtered = []
        for w in words:
            if w["end"] > start and w["start"] < end:
                filtered.append({
                    "start": max(0, w["start"] - start),
                    "end": w["end"] - start,
                    "word": w["word"],
                })
        return filtered


pipeline = ShortsGenerationPipeline()
