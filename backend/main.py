import os
import sys
import json
import uuid
import threading
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

sys.path.insert(0, os.path.dirname(__file__))
from srt_parser import parse_srt, subtitles_to_text, extract_subtitle_range
from ai_analyzer import analyze_subtitles
from video_processor import (
    cut_video, batch_cut_videos, get_video_info,
    SUBTITLE_TEMPLATES, parse_time_to_seconds,
)
from youtube_downloader import is_youtube_url, download_youtube
from whisper_generator import generate_srt_from_video

app = FastAPI(title="롱숏 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "output")
TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "..", "templates")
DOWNLOADS_DIR = os.path.join(os.path.dirname(__file__), "..", "downloads")
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(TEMPLATES_DIR, exist_ok=True)
os.makedirs(DOWNLOADS_DIR, exist_ok=True)

# 세션별 상태 저장 (파일 백업으로 서버 재시작에도 유지)
SESSIONS_FILE = os.path.join(os.path.dirname(__file__), "..", "output", "sessions.json")
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


def _prepare_worker(progress_id: str, video_input: str, srt_path: str, whisper_model: str):
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
            _update_progress(progress_id, "download", 50, "YouTube 다운로드 완료")
        except Exception as e:
            _update_progress(progress_id, "error", 0, f"YouTube 다운로드 실패: {str(e)}")
            return

    # 로컬 파일 확인
    if not os.path.exists(video_path):
        _update_progress(progress_id, "error", 0, f"영상 파일을 찾을 수 없습니다: {video_path}")
        return

    # 자막이 없으면 Whisper로 자동 생성
    whisper_used = False
    if not srt_file:
        _update_progress(progress_id, "whisper", 30, "Whisper 모델 로딩 중...")
        try:
            srt_file = generate_srt_from_video(
                video_path, DOWNLOADS_DIR, whisper_model,
                progress_callback=lambda pct, msg: _update_progress(progress_id, "whisper", 30 + int(pct * 0.65), msg)
            )
            whisper_used = True
            _update_progress(progress_id, "whisper", 95, "자막 생성 완료")
        except Exception as e:
            _update_progress(progress_id, "error", 0, f"Whisper 자막 생성 실패: {str(e)}")
            return
    else:
        _update_progress(progress_id, "prepare", 80, "자막 파일 확인 중...")

    if not os.path.exists(srt_file):
        _update_progress(progress_id, "error", 0, f"자막 파일을 찾을 수 없습니다: {srt_file}")
        return

    # 세션 생성
    video_info = {}
    try:
        video_info = get_video_info(video_path)
    except Exception:
        pass

    sessions[progress_id] = {
        "video_path": video_path,
        "srt_path": srt_file,
    }
    _save_sessions()

    # 결과를 progress_store에 저장하여 프론트엔드가 폴링으로 가져갈 수 있게 함
    _update_progress(progress_id, "done", 100, "준비 완료")
    progress_store[progress_id]["result"] = {
        "session_id": progress_id,
        "video_path": video_path,
        "srt_path": srt_file,
        "youtube_title": youtube_title,
        "whisper_used": whisper_used,
        "video_info": video_info,
    }


@app.post("/api/prepare")
async def prepare(
    video_input: str = Form(...),
    srt_path: str = Form(""),
    whisper_model: str = Form("base"),
    progress_id: str = Form(""),
):
    """Step 1+2: 영상 준비 - 백그라운드로 실행하고 즉시 응답"""
    if not progress_id:
        progress_id = str(uuid.uuid4())[:8]

    _update_progress(progress_id, "starting", 5, "작업 시작 중...")

    thread = threading.Thread(
        target=_prepare_worker,
        args=(progress_id, video_input, srt_path, whisper_model),
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

    # 러닝타임 제한 (10~60초)
    clip_duration = max(10, min(60, clip_duration))

    session = sessions[session_id]
    video_path = session["video_path"]
    srt_path = session["srt_path"]

    subtitles = parse_srt(srt_path)
    subtitle_text = subtitles_to_text(subtitles)

    clips = analyze_subtitles(subtitle_text, num_clips, custom_prompt, clip_duration)

    sessions[session_id]["subtitles"] = subtitles
    sessions[session_id]["clips"] = clips
    _save_sessions()

    video_info = {}
    try:
        video_info = get_video_info(video_path)
    except Exception:
        pass

    return {
        "session_id": session_id,
        "clips": clips,
        "total_subtitles": len(subtitles),
        "video_info": video_info,
    }


@app.post("/api/generate")
async def generate(
    session_id: str = Form(...),
    selected_indices: str = Form("all"),  # "all" or "0,1,3"
    crop_vertical: bool = Form(False),
    burn_subtitles: bool = Form(False),
    subtitle_template: str = Form("basic"),
):
    """Step 5+6: 선택한 구간의 영상을 생성"""
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

    # 세션별 출력 폴더
    session_output = os.path.join(OUTPUT_DIR, session_id)
    os.makedirs(session_output, exist_ok=True)

    _update_progress(session_id, "generate", 5, f"0/{len(selected_clips)}개 영상 생성 중...")

    results = batch_cut_videos(
        video_path=session["video_path"],
        clips=selected_clips,
        output_dir=session_output,
        crop_vertical=crop_vertical,
        srt_path=session["srt_path"] if burn_subtitles else None,
        subtitle_template=subtitle_template,
        all_subtitles=session.get("subtitles") if burn_subtitles else None,
        progress_callback=lambda done, total: _update_progress(
            session_id, "generate",
            5 + int(done / total * 90),
            f"{done}/{total}개 영상 생성 완료"
        ),
    )

    _update_progress(session_id, "done", 100, f"{len(results)}개 영상 생성 완료")

    return {
        "session_id": session_id,
        "generated": len(results),
        "files": [os.path.basename(r) for r in results],
        "output_dir": session_output,
    }


@app.get("/api/download/{session_id}/{filename}")
async def download(session_id: str, filename: str):
    """생성된 영상 다운로드"""
    file_path = os.path.join(OUTPUT_DIR, session_id, filename)
    if not os.path.exists(file_path):
        raise HTTPException(404, "파일을 찾을 수 없습니다.")
    return FileResponse(file_path, media_type="video/mp4", filename=filename)


@app.get("/api/templates")
def list_templates():
    """기본 자막 템플릿 + 사용자 저장 템플릿 목록"""
    user_templates = {}
    user_file = os.path.join(TEMPLATES_DIR, "user_templates.json")
    if os.path.exists(user_file):
        with open(user_file, "r", encoding="utf-8") as f:
            user_templates = json.load(f)

    return {
        "default": SUBTITLE_TEMPLATES,
        "user": user_templates,
    }


@app.post("/api/templates/save")
async def save_template(
    name: str = Form(...),
    template_data: str = Form(...),
):
    """사용자 자막 템플릿 저장"""
    user_file = os.path.join(TEMPLATES_DIR, "user_templates.json")
    templates = {}
    if os.path.exists(user_file):
        with open(user_file, "r", encoding="utf-8") as f:
            templates = json.load(f)

    templates[name] = json.loads(template_data)

    with open(user_file, "w", encoding="utf-8") as f:
        json.dump(templates, f, ensure_ascii=False, indent=2)

    return {"status": "saved", "name": name}


@app.delete("/api/templates/{name}")
async def delete_template(name: str):
    """사용자 자막 템플릿 삭제"""
    user_file = os.path.join(TEMPLATES_DIR, "user_templates.json")
    if not os.path.exists(user_file):
        raise HTTPException(404, "저장된 템플릿이 없습니다.")

    with open(user_file, "r", encoding="utf-8") as f:
        templates = json.load(f)

    if name not in templates:
        raise HTTPException(404, f"템플릿 '{name}'을 찾을 수 없습니다.")

    del templates[name]
    with open(user_file, "w", encoding="utf-8") as f:
        json.dump(templates, f, ensure_ascii=False, indent=2)

    return {"status": "deleted", "name": name}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
