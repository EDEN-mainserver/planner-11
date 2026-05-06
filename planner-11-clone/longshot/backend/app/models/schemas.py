"""API 요청/응답 스키마"""
from pydantic import BaseModel, Field


# --- 프로젝트 ---

class ProjectCreate(BaseModel):
    source_type: str = Field(..., pattern="^(youtube|upload)$")
    youtube_url: str | None = None
    title: str | None = None


class ProjectResponse(BaseModel):
    id: str
    title: str
    source_type: str
    youtube_url: str | None = None
    duration_seconds: int | None = None
    status: str
    shorts_count: int = 0
    thumbnail_url: str | None = None


# --- 쇼츠 생성 ---

class GenerateOptions(BaseModel):
    remove_silence: bool = False
    add_hook_voice: bool = False
    subtitle_style: str = Field("karaoke", pattern="^(karaoke|highlight|simple)$")
    language: str = "ko"


class GenerateRequest(BaseModel):
    options: GenerateOptions = GenerateOptions()


class ShortResponse(BaseModel):
    id: str
    status: str
    video_path: str | None = None
    thumbnail_path: str | None = None
    title: str | None = None
    description: str | None = None
    hashtags: list[str] = []
    highlight_start: float | None = None
    highlight_end: float | None = None
    hook_text: str | None = None
    score: int | None = None


# --- 진행 상태 ---

class PipelineStatus(BaseModel):
    project_id: str
    status: str  # pending, downloading, transcribing, detecting, processing, completed, error
    progress: int = 0  # 0~100
    current_step: str = ""
    shorts_completed: int = 0
    shorts_total: int = 0
    error: str | None = None
