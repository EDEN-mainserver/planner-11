# 영상 처리 라우터 - FFmpeg / Whisper 연동
from fastapi import APIRouter

router = APIRouter(prefix="/video", tags=["video"])

# TODO: 영상 업로드, 변환, 자막 추출 엔드포인트 구현
