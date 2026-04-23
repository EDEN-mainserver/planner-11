import os
import sys
import whisper


def generate_srt_from_video(video_path: str, output_dir: str, model_size: str = "base", progress_callback=None) -> str:
    """Whisper로 영상에서 자막(SRT) 자동 생성"""
    os.makedirs(output_dir, exist_ok=True)

    if progress_callback:
        progress_callback(5, f"Whisper {model_size} 모델 로딩 중...")
    model = whisper.load_model(model_size)
    if progress_callback:
        progress_callback(15, "음성 분석 중... (영상 길이에 따라 수 분 소요)")

    # tqdm 진행률을 캡처하기 위한 래퍼
    _original_stderr = sys.stderr
    class ProgressCapture:
        def __init__(self):
            self.last_pct = 0
        def write(self, text):
            _original_stderr.write(text)
            if '%|' in text:
                try:
                    pct_str = text.strip().split('%|')[0].strip().split()[-1]
                    pct = int(pct_str)
                    if pct != self.last_pct and progress_callback:
                        self.last_pct = pct
                        progress_callback(15 + int(pct * 0.80), f"음성 인식 중... {pct}%")
                except (ValueError, IndexError):
                    pass
        def flush(self):
            _original_stderr.flush()

    if progress_callback:
        sys.stderr = ProgressCapture()

    try:
        result = model.transcribe(video_path, language=None, verbose=False)
    finally:
        sys.stderr = _original_stderr

    if progress_callback:
        progress_callback(97, "자막 파일 저장 중...")

    # SRT 파일로 저장
    base_name = os.path.splitext(os.path.basename(video_path))[0]
    srt_path = os.path.join(output_dir, f"{base_name}.srt")

    with open(srt_path, "w", encoding="utf-8") as f:
        for i, segment in enumerate(result["segments"], 1):
            start = format_timestamp(segment["start"])
            end = format_timestamp(segment["end"])
            text = segment["text"].strip()
            f.write(f"{i}\n{start} --> {end}\n{text}\n\n")

    detected_lang = result.get("language", "unknown")
    return srt_path


def format_timestamp(seconds: float) -> str:
    """초를 SRT 타임스탬프 형식으로 변환"""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
