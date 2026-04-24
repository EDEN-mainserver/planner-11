"""ASS 자막 파일 생성 서비스 — 단어 단위 하이라이트 애니메이션"""
from pathlib import Path


class SubtitleRenderer:
    """Whisper 단어 타임스탬프 → ASS 자막 파일 생성"""

    # ASS 헤더 템플릿
    ASS_HEADER = """[Script Info]
Title: LongShot Subtitles
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Pretendard,52,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,2,40,40,120,1
Style: Highlight,Pretendard,52,&H0000BFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,2,40,40,120,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    def generate_ass(
        self,
        words: list[dict],
        output_path: str,
        style: str = "karaoke",
        max_chars_per_line: int = 15,
    ) -> str:
        """
        단어 리스트 → ASS 자막 파일 생성.

        Args:
            words: [{"start": float, "end": float, "word": str}, ...]
            output_path: 출력 .ass 파일 경로
            style: "karaoke" | "highlight" | "simple"
            max_chars_per_line: 한 줄 최대 글자 수
        """
        # 단어를 줄 단위로 그룹핑
        lines = self._group_words_to_lines(words, max_chars_per_line)

        events = []
        for line_words in lines:
            if not line_words:
                continue

            line_start = line_words[0]["start"]
            line_end = line_words[-1]["end"]

            if style == "karaoke":
                # 단어가 나올 때마다 색상이 바뀌는 노래방 스타일
                event = self._make_karaoke_event(line_words, line_start, line_end)
            elif style == "highlight":
                # 현재 단어만 노란색 하이라이트
                event = self._make_highlight_event(line_words, line_start, line_end)
            else:
                # 단순 자막
                text = " ".join(w["word"] for w in line_words)
                event = (
                    f"Dialogue: 0,{self._fmt(line_start)},{self._fmt(line_end)},"
                    f"Default,,0,0,0,,{text}"
                )

            events.append(event)

        content = self.ASS_HEADER + "\n".join(events) + "\n"
        Path(output_path).write_text(content, encoding="utf-8")
        return output_path

    def _make_karaoke_event(
        self, words: list[dict], line_start: float, line_end: float
    ) -> str:
        """노래방 스타일: 단어마다 타이밍에 맞춰 색상 전환"""
        parts = []
        for w in words:
            # 이 단어가 나오기까지의 대기 시간 (centiseconds)
            duration_cs = int((w["end"] - w["start"]) * 100)
            parts.append(f"{{\\kf{duration_cs}}}{w['word']}")

        text = " ".join(parts) if any(len(w["word"]) > 2 for w in words) else "".join(parts)

        return (
            f"Dialogue: 0,{self._fmt(line_start)},{self._fmt(line_end)},"
            f"Default,,0,0,0,,{text}"
        )

    def _make_highlight_event(
        self, words: list[dict], line_start: float, line_end: float
    ) -> str:
        """현재 단어만 하이라이트 색상"""
        events = []
        for i, w in enumerate(words):
            parts = []
            for j, other in enumerate(words):
                if j == i:
                    parts.append(f"{{\\c&H0000BFFF&}}{other['word']}{{\\c&HFFFFFF&}}")
                else:
                    parts.append(other["word"])
            text = " ".join(parts) if any(len(x["word"]) > 2 for x in words) else "".join(parts)
            events.append(
                f"Dialogue: 0,{self._fmt(w['start'])},{self._fmt(w['end'])},"
                f"Default,,0,0,0,,{text}"
            )
        return "\n".join(events)

    def _group_words_to_lines(
        self, words: list[dict], max_chars: int
    ) -> list[list[dict]]:
        """단어를 줄 단위로 그룹핑 (글자 수 기준)"""
        lines = []
        current_line = []
        current_len = 0

        for w in words:
            word_len = len(w["word"])
            if current_len + word_len > max_chars and current_line:
                lines.append(current_line)
                current_line = []
                current_len = 0
            current_line.append(w)
            current_len += word_len + 1  # +1 for space

        if current_line:
            lines.append(current_line)

        return lines

    @staticmethod
    def _fmt(seconds: float) -> str:
        """초 → ASS 타임코드 (H:MM:SS.CC)"""
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = int(seconds % 60)
        cs = int((seconds % 1) * 100)
        return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


subtitle_renderer = SubtitleRenderer()
