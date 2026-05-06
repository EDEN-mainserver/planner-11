"""홈 대시보드 라우트."""
from flask import Blueprint, render_template, request, jsonify

from data import CURRENT_USER, GUIDES, NEWS
from services.sessions import _load as load_sessions

bp = Blueprint("home", __name__)


def _calc_stats():
    """실제 배치 데이터에서 진행 현황 계산."""
    sessions = load_sessions()
    my_sign = 0      # 내 서명 필요
    other_sign = 0   # 상대 서명 필요
    completed = 0    # 서명 완료
    scheduled = 0    # 예약 중

    my_email = CURRENT_USER["email"].lower()

    for batch in sessions.values():
        status = batch.get("status", "")
        if status == "completed":
            completed += 1
        elif status == "sent":
            has_my_pending = False
            has_other_pending = False
            for s in batch.get("signers", []):
                if s.get("status") == "pending":
                    if s.get("contact", "").lower() == my_email:
                        has_my_pending = True
                    else:
                        has_other_pending = True
            if has_my_pending:
                my_sign += 1
            if has_other_pending:
                other_sign += 1

    return [
        {"label": "내 서명 필요",   "count": my_sign,     "color": "#ff9900"},
        {"label": "상대 서명 필요", "count": other_sign,   "color": "#5991f4"},
        {"label": "서명 완료",     "count": completed,    "color": "#00a77f"},
        {"label": "예약 중",       "count": scheduled,    "color": "#000000"},
    ]


@bp.route("/")
def index():
    return render_template(
        "home.html",
        user=CURRENT_USER,
        stats=_calc_stats(),
        guides=GUIDES,
        news=NEWS,
    )


@bp.route("/documents")
def documents():
    """문서함: 모든 배치 목록."""
    sessions = load_sessions()
    batches = sorted(sessions.values(), key=lambda b: b.get("created_at", ""), reverse=True)
    return render_template("documents.html", user=CURRENT_USER, batches=batches)


@bp.route("/search")
def search():
    """문서 검색."""
    q = (request.args.get("q") or "").strip().lower()
    if not q:
        return jsonify([])
    sessions = load_sessions()
    results = []
    for batch in sessions.values():
        if q in batch.get("title", "").lower():
            results.append({
                "batch_id": batch["batch_id"],
                "title": batch.get("title", ""),
                "status": batch.get("status", ""),
                "created_at": batch.get("created_at", ""),
            })
    return jsonify(results)
