"""앱 전역 설정/상수."""
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Render에서는 영구 디스크 마운트 경로(예: /var/data)를 UPLOAD_FOLDER로 지정
UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", os.path.join(BASE_DIR, "uploads"))

ALLOWED_PDF = {"pdf"}
ALLOWED_DOC = {"hwp", "hwpx", "docx", "xlsx", "pptx", "jpg", "jpeg", "png"}

MAX_PDF_BYTES = 10 * 1024 * 1024   # 10MB
MAX_DOC_BYTES = 5 * 1024 * 1024    # 5MB
MAX_CONTENT_LENGTH = MAX_PDF_BYTES + 1024
