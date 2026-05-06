"""쇼츠 생성/관리 API"""
import asyncio
import logging
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pathlib import Path

from app.models.schemas import GenerateRequest, PipelineStatus
from app.services.pipeline import pipeline
from app.api.projects import get_projects_store

logger = logging.getLogger(__name__)
router = APIRouter()

# 파이프라인 진행 상태 추적
_pipeline_status: dict[str, PipelineStatus] = {}


@router.get("/{project_id}")
async def list_shorts(project_id: str):
    """프로젝트 내 생성된 쇼츠 목록"""
    projects = get_projects_store()
    if project_id not in projects:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")

    return {
        "project_id": project_id,
        "shorts": projects[project_id].get("shorts", []),
    }


@router.get("/{project_id}/status")
async def get_generation_status(project_id: str):
    """쇼츠 생성 진행 상태 조회"""
    if project_id in _pipeline_status:
        return _pipeline_status[project_id]
    return PipelineStatus(
        project_id=project_id, status="idle", current_step="대기 중"
    )


@router.post("/{project_id}/generate")
async def generate_shorts(
    project_id: str,
    body: GenerateRequest = GenerateRequest(),
    background_tasks: BackgroundTasks = None,
):
    """AI 쇼츠 생성 시작 (백그라운드 작업)"""
    projects = get_projects_store()
    if project_id not in projects:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")

    project = projects[project_id]

    if project["status"] == "processing":
        raise HTTPException(status_code=409, detail="이미 생성 중입니다")

    # 상태 초기화
    project["status"] = "processing"
    _pipeline_status[project_id] = PipelineStatus(
        project_id=project_id,
        status="downloading",
        current_step="영상 준비 중...",
        progress=0,
    )

    # 백그라운드로 파이프라인 실행
    background_tasks.add_task(
        _run_pipeline, project_id, project, body.options.model_dump()
    )

    return {
        "message": "쇼츠 생성이 시작되었습니다",
        "project_id": project_id,
        "status_url": f"/api/shorts/{project_id}/status",
    }


@router.get("/{project_id}/shorts/{short_id}/download")
async def download_short(project_id: str, short_id: str):
    """생성된 쇼츠 영상 다운로드"""
    projects = get_projects_store()
    if project_id not in projects:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")

    short = next(
        (s for s in projects[project_id].get("shorts", []) if s["id"] == short_id),
        None,
    )
    if not short or not short.get("video_path"):
        raise HTTPException(status_code=404, detail="쇼츠를 찾을 수 없습니다")

    video_path = Path(short["video_path"])
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="영상 파일이 없습니다")

    return FileResponse(
        video_path,
        media_type="video/mp4",
        filename=f"{short.get('title', short_id)}.mp4",
    )


async def _run_pipeline(project_id: str, project: dict, options: dict):
    """백그라운드 파이프라인 실행"""
    try:
        _pipeline_status[project_id].status = "processing"
        _pipeline_status[project_id].current_step = "파이프라인 실행 중..."
        _pipeline_status[project_id].progress = 10

        result = await pipeline.run(
            project_id=project_id,
            source_type=project["source_type"],
            youtube_url=project.get("youtube_url"),
            uploaded_file_path=project.get("source_file_path"),
            options=options,
        )

        # 결과 저장
        project["shorts"] = result["shorts"]
        project["status"] = "completed"
        project["duration_seconds"] = result["source"].get("duration")
        project["thumbnail_url"] = result["source"].get("thumbnail_url")

        completed = sum(1 for s in result["shorts"] if s.get("status") == "completed")
        _pipeline_status[project_id] = PipelineStatus(
            project_id=project_id,
            status="completed",
            progress=100,
            current_step="완료",
            shorts_completed=completed,
            shorts_total=len(result["shorts"]),
        )

    except Exception as e:
        logger.error(f"파이프라인 실패 [{project_id}]: {e}")
        project["status"] = "error"
        _pipeline_status[project_id] = PipelineStatus(
            project_id=project_id,
            status="error",
            current_step="오류 발생",
            error=str(e),
        )
