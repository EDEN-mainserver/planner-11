"""프로젝트 관리 API"""
import uuid
import shutil
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException

from app.core.config import settings
from app.models.schemas import ProjectCreate, ProjectResponse

router = APIRouter()

# 인메모리 프로젝트 저장소 (v1 — DB 연동 전까지 사용)
_projects: dict[str, dict] = {}


@router.get("/")
async def list_projects():
    """사용자의 프로젝트 목록 조회"""
    projects = [
        ProjectResponse(
            id=p["id"],
            title=p["title"],
            source_type=p["source_type"],
            youtube_url=p.get("youtube_url"),
            duration_seconds=p.get("duration_seconds"),
            status=p["status"],
            shorts=p.get("shorts", []),
            shorts_count=len(p.get("shorts", [])),
            thumbnail_url=p.get("thumbnail_url"),
        )
        for p in _projects.values()
    ]
    return {"projects": projects}


@router.get("/{project_id}")
async def get_project(project_id: str):
    """프로젝트 상세 조회"""
    if project_id not in _projects:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")
    return _projects[project_id]


@router.post("/")
async def create_project(body: ProjectCreate):
    """새 프로젝트 생성 (유튜브 URL)"""
    project_id = f"prj_{uuid.uuid4().hex[:12]}"
    project = {
        "id": project_id,
        "title": body.title or "새 프로젝트",
        "source_type": body.source_type,
        "youtube_url": body.youtube_url,
        "status": "pending",
        "shorts": [],
        "duration_seconds": None,
        "thumbnail_url": None,
        "source_file_path": None,
    }
    _projects[project_id] = project
    return project


@router.post("/upload")
async def create_project_upload(file: UploadFile = File(...)):
    """파일 업로드로 새 프로젝트 생성"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="파일이 필요합니다")

    allowed_ext = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed_ext:
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 형식: {ext}. 지원: {', '.join(allowed_ext)}"
        )

    project_id = f"prj_{uuid.uuid4().hex[:12]}"
    project_dir = Path(settings.upload_dir) / project_id
    project_dir.mkdir(parents=True, exist_ok=True)

    # 파일 저장
    file_path = project_dir / f"source{ext}"
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    project = {
        "id": project_id,
        "title": Path(file.filename).stem,
        "source_type": "upload",
        "youtube_url": None,
        "status": "pending",
        "shorts": [],
        "duration_seconds": None,
        "thumbnail_url": None,
        "source_file_path": str(file_path),
    }
    _projects[project_id] = project
    return project


@router.delete("/{project_id}")
async def delete_project(project_id: str):
    """프로젝트 삭제"""
    if project_id not in _projects:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")

    # 관련 파일 정리
    for dir_path in [
        Path(settings.upload_dir) / project_id,
        Path(settings.output_dir) / project_id,
    ]:
        if dir_path.exists():
            shutil.rmtree(dir_path)

    del _projects[project_id]
    return {"message": "삭제되었습니다"}


def get_projects_store() -> dict:
    """인메모리 저장소 접근 (shorts API에서 사용)"""
    return _projects
