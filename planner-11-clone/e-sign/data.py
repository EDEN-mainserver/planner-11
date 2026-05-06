"""더미 데이터. DB 연동 시 이 모듈을 모델/리포지토리로 교체."""

CURRENT_USER = {
    "name": "정지한",
    "workspace": "TEAM EDEN",
    "email": "eden@teamedenmarketing.com",
}

DASHBOARD_STATS = [
    {"label": "내 서명 필요",   "count": 0, "color": "#ff9900"},
    {"label": "상대 서명 필요", "count": 0, "color": "#5991f4"},
    {"label": "서명 완료",     "count": 0, "color": "#00a77f"},
    {"label": "예약 중",       "count": 0, "color": "#000000"},
]

GUIDES = [
    {"title": "서명 요청 방법",   "icon": "paper-plane"},
    {"title": "첫 이용자 가이드", "icon": "book-open"},
    {"title": "템플릿 이용 방법", "icon": "file-lines"},
]

NEWS = [
    {"title": "‘서명자 입력란 사전 입력’ 기능 추가",      "date": "2026.03.31"},
    {"title": "진본증명도장 기능 추가",                    "date": "2026.01.19"},
    {"title": "‘문서 작업 권한 관리 (권한 부여)’ 기능 추가", "date": "2025.12.29"},
]

RECOMMENDED_TEMPLATES = [
    {
        "title": "개인정보 이용 내역 안내서",
        "tag": "열람",
        "thumbnail": "https://cdn.modusign.co.kr/service/sample-templates/thumbnail/5bd34046-8a9c-49be-9f48-8f2ba05ee093.png",
    },
    {
        "title": "견적서",
        "tag": "열람",
        "thumbnail": "https://cdn.modusign.co.kr/service/sample-templates/thumbnail/e1776cf1-09ff-4857-8b1a-3c29ee8d7188.png",
    },
    {
        "title": "급여 명세서",
        "tag": "열람",
        "thumbnail": "https://cdn.modusign.co.kr/service/sample-templates/thumbnail/ac94fb9f-30eb-4c3d-831a-a79abc9b3cd6.png",
    },
    {
        "title": "수기 세금계산서",
        "tag": "서명",
        "thumbnail": "https://cdn.modusign.co.kr/service/sample-templates/thumbnail/ca6000f2-4cc9-4424-ae01-fff1581d2b4a.png",
    },
    {
        "title": "발주서",
        "tag": "열람",
        "thumbnail": "https://cdn.modusign.co.kr/service/sample-templates/thumbnail/3e4a5d9b-3132-439e-94de-9e4daa63f79b.png",
    },
]
