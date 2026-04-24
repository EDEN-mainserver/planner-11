import os
import sys
import json
import uuid
import threading
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

sys.path.insert(0, os.path.dirname(__file__))
from srt_parser import parse_srt, subtitles_to_text
from ai_analyzer import analyze_subtitles
from youtube_downloader import is_youtube_url, download_youtube
from capcut_generator import (
    generate_capcut_draft, generate_individual_drafts,
    copy_drafts_to_capcut,
)

app = FastAPI(title="롱숏 API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "output")
DOWNLOADS_DIR = os.path.join(os.path.dirname(__file__), "..", "downloads")
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(DOWNLOADS_DIR, exist_ok=True)

# 세션별 상태 저장
SESSIONS_FILE = os.path.join(OUTPUT_DIR, "sessions.json")
sessions = {}

def _load_sessions():
    global sessions
    if os.path.exists(SESSIONS_FILE):
        try:
            with open(SESSIONS_FILE, "r", encoding="utf-8") as f:
                sessions = json.load(f)
        except Exception:
            sessions = {}

def _save_sessions():
    try:
        with open(SESSIONS_FILE, "w", encoding="utf-8") as f:
            json.dump(sessions, f, ensure_ascii=False)
    except Exception:
        pass

_load_sessions()

# 진행률 추적 (인메모리)
progress_store = {}

def _update_progress(session_id: str, stage: str, percent: int, message: str = ""):
    progress_store[session_id] = {
        "stage": stage,
        "percent": percent,
        "message": message,
    }


@app.get("/api/progress/{session_id}")
def get_progress(session_id: str):
    """현재 작업 진행률 조회 (완료 시 result 포함)"""
    return progress_store.get(session_id, {"stage": "idle", "percent": 0, "message": ""})


@app.post("/api/progress/start")
def start_progress():
    """진행률 추적용 ID를 미리 발급"""
    pid = str(uuid.uuid4())[:8]
    _update_progress(pid, "waiting", 0, "대기 중...")
    return {"progress_id": pid}


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/check-subtitle")
def check_subtitle(url: str):
    """YouTube URL의 자막 존재 여부를 미리 확인"""
    if not is_youtube_url(url):
        return {"has_subtitle": False, "source": None}
    try:
        import subprocess
        result = subprocess.run(
            ["yt-dlp", "--list-subs", "--skip-download", url],
            capture_output=True, text=True, timeout=15
        )
        output = result.stdout + result.stderr
        has_ko = "ko" in output and ("subtitle" in output.lower() or "caption" in output.lower())
        has_en = "en" in output and ("subtitle" in output.lower() or "caption" in output.lower())
        if has_ko:
            return {"has_subtitle": True, "source": "YouTube (한국어)"}
        elif has_en:
            return {"has_subtitle": True, "source": "YouTube (영어)"}
        else:
            return {"has_subtitle": False, "source": None}
    except Exception:
        return {"has_subtitle": False, "source": None}


def _prepare_worker(progress_id: str, video_input: str, srt_path: str):
    """백그라운드에서 영상 준비 작업 수행"""
    video_path = video_input
    srt_file = srt_path if srt_path else None
    youtube_title = None

    # YouTube URL인 경우 다운로드
    if is_youtube_url(video_input):
        _update_progress(progress_id, "download", 10, "YouTube 영상 다운로드 중...")
        try:
            dl_result = download_youtube(video_input, DOWNLOADS_DIR)
            video_path = dl_result["video_path"]
            youtube_title = dl_result["title"]
            if dl_result.get("srt_path") and not srt_file:
                srt_file = dl_result["srt_path"]
            _update_progress(progress_id, "download", 80, "YouTube 다운로드 완료")
        except Exception as e:
            _update_progress(progress_id, "error", 0, f"YouTube 다운로드 실패: {str(e)}")
            return

    # 로컬 파일 확인
    if not os.path.exists(video_path):
        _update_progress(progress_id, "error", 0, f"영상 파일을 찾을 수 없습니다: {video_path}")
        return

    # 자막이 없으면 → 캡컷 자동자막 사용 안내 (Whisper 제거)
    subtitle_mode = "capcut_auto"
    if srt_file and os.path.exists(srt_file):
        subtitle_mode = "srt"
        _update_progress(progress_id, "prepare", 90, "자막 파일 확인 완료")
    else:
        srt_file = None
        _update_progress(progress_id, "prepare", 90, "자막 없음 → 캡컷 자동자막 사용")

    # 세션 생성
    sessions[progress_id] = {
        "video_path": video_path,
        "srt_path": srt_file,
        "subtitle_mode": subtitle_mode,
    }
    _save_sessions()

    _update_progress(progress_id, "done", 100, "준비 완료")
    progress_store[progress_id]["result"] = {
        "session_id": progress_id,
        "video_path": video_path,
        "srt_path": srt_file,
        "youtube_title": youtube_title,
        "subtitle_mode": subtitle_mode,
    }


@app.post("/api/prepare")
async def prepare(
    video_input: str = Form(...),
    srt_path: str = Form(""),
    progress_id: str = Form(""),
):
    """Step 1+2: 영상 준비 - 백그라운드로 실행하고 즉시 응답"""
    if not progress_id:
        progress_id = str(uuid.uuid4())[:8]

    _update_progress(progress_id, "starting", 5, "작업 시작 중...")

    thread = threading.Thread(
        target=_prepare_worker,
        args=(progress_id, video_input, srt_path),
        daemon=True,
    )
    thread.start()

    return {"progress_id": progress_id, "status": "started"}


@app.post("/api/analyze")
async def analyze(
    session_id: str = Form(...),
    num_clips: int = Form(5),
    custom_prompt: str = Form(""),
    clip_duration: int = Form(60),
):
    """Step 3: AI 자막 분석 → 숏폼 구간 추천"""
    if session_id not in sessions:
        raise HTTPException(400, "세션을 찾을 수 없습니다.")

    clip_duration = max(10, min(60, clip_duration))

    session = sessions[session_id]
    srt_path = session.get("srt_path")

    if not srt_path or not os.path.exists(srt_path):
        raise HTTPException(400, "자막 파일이 없습니다. SRT 파일을 제공하거나 YouTube 자막이 있는 영상을 사용하세요.")

    subtitles = parse_srt(srt_path)
    subtitle_text = subtitles_to_text(subtitles)

    clips = analyze_subtitles(subtitle_text, num_clips, custom_prompt, clip_duration)

    sessions[session_id]["subtitles"] = subtitles
    sessions[session_id]["clips"] = clips
    _save_sessions()

    return {
        "session_id": session_id,
        "clips": clips,
        "total_subtitles": len(subtitles),
    }


@app.post("/api/generate")
async def generate(
    session_id: str = Form(...),
    selected_indices: str = Form("all"),
    crop_vertical: bool = Form(False),
    include_subtitles: bool = Form(False),
    draft_mode: str = Form("individual"),  # "individual" or "combined"
    install_to_capcut: bool = Form(True),
):
    """선택한 구간으로 캡컷 드래프트 생성"""
    if session_id not in sessions:
        raise HTTPException(400, "세션을 찾을 수 없습니다. 먼저 분석을 실행하세요.")

    session = sessions[session_id]
    clips = session.get("clips", [])

    if selected_indices == "all":
        selected_clips = clips
    else:
        indices = [int(i) for i in selected_indices.split(",")]
        selected_clips = [clips[i] for i in indices if i < len(clips)]

    if not selected_clips:
        raise HTTPException(400, "선택된 클립이 없습니다.")

    session_output = os.path.join(OUTPUT_DIR, session_id)
    os.makedirs(session_output, exist_ok=True)

    _update_progress(session_id, "generate", 5, "캡컷 드래프트 생성 중...")

    subtitles_data = session.get("subtitles") if include_subtitles else None

    try:
        if draft_mode == "combined":
            # 모든 클립을 하나의 드래프트로
            draft_path = generate_capcut_draft(
                video_path=session["video_path"],
                clips=selected_clips,
                output_dir=session_output,
                draft_name=f"롱숏_{session_id}",
                vertical=crop_vertical,
                subtitles=subtitles_data,
                progress_callback=lambda done, total: _update_progress(
                    session_id, "generate",
                    5 + int(done / total * 85),
                    f"{done}/{total}개 클립 처리 완료"
                ),
            )
            draft_paths = [draft_path]
        else:
            # 각 클립별 개별 드래프트
            draft_paths = generate_individual_drafts(
                video_path=session["video_path"],
                clips=selected_clips,
                output_dir=session_output,
                vertical=crop_vertical,
                subtitles=subtitles_data,
                progress_callback=lambda done, total: _update_progress(
                    session_id, "generate",
                    5 + int(done / total * 85),
                    f"{done}/{total}개 드래프트 생성 완료"
                ),
            )

        # 캡컷 드래프트 폴더로 자동 복사
        installed_paths = []
        if install_to_capcut:
            _update_progress(session_id, "install", 92, "캡컷 드래프트 폴더에 설치 중...")
            installed_paths = copy_drafts_to_capcut(draft_paths)

        _update_progress(session_id, "done", 100,
                        f"{len(draft_paths)}개 드래프트 생성 완료! 캡컷을 열어 확인하세요.")

        return {
            "session_id": session_id,
            "generated": len(draft_paths),
            "draft_names": [os.path.basename(p) for p in draft_paths],
            "output_dir": session_output,
            "installed_to_capcut": len(installed_paths) > 0,
            "capcut_paths": installed_paths,
        }

    except Exception as e:
        _update_progress(session_id, "error", 0, str(e))
        raise HTTPException(500, f"드래프트 생성 실패: {str(e)}")


@app.get("/api/download/{session_id}/{filename}")
async def download(session_id: str, filename: str):
    """생성된 파일 다운로드"""
    file_path = os.path.join(OUTPUT_DIR, session_id, filename)
    if not os.path.exists(file_path):
        raise HTTPException(404, "파일을 찾을 수 없습니다.")
    return FileResponse(file_path, filename=filename)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
