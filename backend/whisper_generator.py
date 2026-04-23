import os
import whisper


def generate_srt_from_video(video_path: str, output_dir: str, model_size: str = "base") -> str:
    """Whisper로 영상에서 자막(SRT) 자동 생성"""
    os.makedirs(output_dir, exist_ok=True)

    model = whisper.load_model(model_size)
    result = model.transcribe(video_path, language=None, verbose=False)

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
