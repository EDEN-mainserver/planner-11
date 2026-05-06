"""서명 요청 플로우 라우트: 업로드/파일 서빙/서명자/편집기/발송."""
import io
import os
import secrets
from datetime import datetime

from flask import (
    Blueprint, render_template, request, jsonify, url_for,
    send_file, abort,
)

from data import CURRENT_USER, RECOMMENDED_TEMPLATES
from services.files import save_upload, get_file_bytes
from services.sessions import create_batch, get_batch, get_by_token, update_batch
from services.email import send_signing_email, is_configured as email_is_configured
from services.pdf_signer import generate_signed_pdf

bp = Blueprint("sign", __name__, url_prefix="/sign")


def _validate_doc_ids(doc_ids_str: str) -> list[str]:
    """콤마 구분 doc_id 문자열을 검증 후 리스트로 반환."""
    ids = [d.strip() for d in doc_ids_str.split(",") if d.strip()]
    if not ids or not all(id.isalnum() for id in ids):
        abort(400)
    return ids


@bp.route("/new")
def new_request():
    """문서 업로드 화면."""
    return render_template(
        "upload.html",
        user=CURRENT_USER,
        templates=RECOMMENDED_TEMPLATES,
    )


@bp.route("/upload", methods=["POST"])
def upload():
    """드래그앤드롭/파일선택으로 올라온 문서 저장."""
    f = request.files.get("file")
    result = save_upload(f)
    if not result["ok"]:
        return jsonify(result), 400

    return jsonify({
        **result,
        "next_url": url_for("sign.prepare", doc_ids=result["doc_id"]),
    })


@bp.route("/file/<doc_id>")
def serve_file(doc_id):
    """업로드된 원본 파일 서빙 (R2 또는 로컬)."""
    if not doc_id.isalnum():
        abort(400)
    fname, data = get_file_bytes(doc_id)
    if not fname or not data:
        abort(404)
    import mimetypes
    mime = mimetypes.guess_type(fname)[0] or "application/octet-stream"
    return send_file(io.BytesIO(data), download_name=fname, mimetype=mime)


@bp.route("/prepare/<doc_ids>")
def prepare(doc_ids):
    """편집기 1단계: 서명자 입력."""
    ids = _validate_doc_ids(doc_ids)
    return render_template(
        "prepare.html",
        user=CURRENT_USER,
        doc_ids=ids,
        current_user_email=CURRENT_USER["email"],
    )


@bp.route("/edit/<doc_ids>")
def edit(doc_ids):
    """편집기 2단계: 입력 - 필드 배치."""
    ids = _validate_doc_ids(doc_ids)
    return render_template(
        "edit.html",
        user=CURRENT_USER,
        doc_ids=ids,
    )


@bp.route("/finalize/<doc_ids>")
def finalize(doc_ids):
    """편집기 3단계: 기타 - 문서 제목/서명 기한/잠금/리마인더 등 최종 설정."""
    ids = _validate_doc_ids(doc_ids)
    return render_template(
        "finalize.html",
        user=CURRENT_USER,
        doc_ids=ids,
    )


@bp.route("/send", methods=["POST"])
def send():
    """전송하기: 서명 토큰 발급 + 이메일 발송 + 배치 저장."""
    try:
        return _do_send()
    except Exception as e:
        from flask import current_app
        if current_app.debug:
            import traceback
            return jsonify({"ok": False, "error": str(e), "trace": traceback.format_exc()}), 500
        return jsonify({"ok": False, "error": "전송 중 오류가 발생했습니다."}), 500


def _do_send():
    data = request.get_json(silent=True) or {}
    title    = (data.get("title") or "").strip() or "제목 없음"
    doc_ids  = data.get("doc_ids") or []
    signers  = data.get("signers") or []
    expire   = int(data.get("expire_days") or 14)
    fields   = data.get("fields") or []
    scale    = float(data.get("scale") or 1.4)

    if not signers:
        return jsonify({"ok": False, "error": "서명자가 없습니다."}), 400

    # 토큰 발급
    enriched = []
    for s in signers:
        enriched.append({
            **s,
            "token": secrets.token_urlsafe(32),
            "status": "pending",
        })

    batch_id = create_batch({
        "title": title,
        "doc_ids": doc_ids,
        "signers": enriched,
        "expire_days": expire,
        "fields": fields,
        "scale": scale,
        "status": "sent",
    })

    # 이메일 발송
    results = []
    for s in enriched:
        if s.get("method") != "email" or not s.get("contact"):
            results.append({"name": s["name"], "status": "skipped",
                            "reason": "이메일 수단 아님"})
            continue
        path = url_for("sign.signing", token=s["token"])
        base = (os.environ.get("PUBLIC_BASE_URL")
                or os.environ.get("RENDER_EXTERNAL_URL"))
        sign_url = (base.rstrip("/") + path) if base else request.host_url.rstrip("/") + path
        ok, info = send_signing_email(
            to_email=s["contact"], signer_name=s["name"],
            doc_title=title, sign_url=sign_url,
        )
        results.append({
            "name": s["name"], "email": s["contact"],
            "status": "sent" if ok else "failed", "info": info,
        })

    return jsonify({
        "ok": True,
        "batch_id": batch_id,
        "results": results,
        "mode": "real" if email_is_configured() else "mock",
        "next_url": url_for("sign.sent", batch_id=batch_id),
    })


@bp.route("/sent/<batch_id>")
def sent(batch_id):
    """전송 완료 화면."""
    batch = get_batch(batch_id)
    if not batch:
        abort(404)
    return render_template("sent.html", user=CURRENT_USER, batch=batch)


@bp.route("/signing/<token>")
def signing(token):
    """서명자가 이메일 링크로 접근하는 화면."""
    batch, signer = get_by_token(token)
    if not batch:
        abort(404)
    signer_idx = next(
        (i for i, s in enumerate(batch["signers"]) if s.get("token") == token),
        None,
    )
    return render_template(
        "signing.html",
        batch=batch,
        signer=signer,
        signer_idx=signer_idx,
        token=token,
    )


@bp.route("/signing/<token>/submit", methods=["POST"])
def signing_submit(token):
    """서명자 필드 값 제출 → 서명자 상태 업데이트, 전원 완료 시 batch 완료."""
    batch, signer = get_by_token(token)
    if not batch:
        return jsonify({"ok": False, "error": "토큰이 유효하지 않습니다."}), 404

    data = request.get_json(silent=True) or {}
    values = data.get("values") or []

    signer["filled"] = values
    signer["status"] = "signed"
    signer["signed_at"] = datetime.utcnow().isoformat()

    all_done = all(s.get("status") == "signed" for s in batch["signers"])
    if all_done:
        batch["status"] = "completed"
        batch["completed_at"] = datetime.utcnow().isoformat()

    update_batch(batch["batch_id"], batch)
    return jsonify({
        "ok": True,
        "all_done": all_done,
        "batch_id": batch["batch_id"],
        "next_url": url_for("sign.signing_done", token=token),
    })


@bp.route("/signing/<token>/done")
def signing_done(token):
    """개별 서명자의 완료 화면."""
    batch, signer = get_by_token(token)
    if not batch:
        abort(404)
    return render_template(
        "signing_done.html",
        batch=batch, signer=signer, token=token,
    )


@bp.route("/download/<batch_id>/<int:doc_idx>")
def download(batch_id, doc_idx):
    """완료된 계약의 서명된 PDF 다운로드."""
    batch = get_batch(batch_id)
    if not batch:
        abort(404)
    all_signed = all(s.get("status") == "signed" for s in batch.get("signers", []))
    if batch.get("status") != "completed" and not all_signed:
        return "아직 모든 서명자가 서명을 완료하지 않았습니다.", 403
    if doc_idx < 0 or doc_idx >= len(batch.get("doc_ids", [])):
        abort(404)
    try:
        pdf_bytes = generate_signed_pdf(batch, doc_idx)
    except FileNotFoundError:
        return "원본 파일을 찾을 수 없습니다.", 404
    except ValueError as e:
        return str(e), 400
    safe_title = batch.get("title", "document").replace("/", "_")
    return send_file(
        io.BytesIO(pdf_bytes),
        download_name=f"{safe_title}_signed_{doc_idx + 1}.pdf",
        mimetype="application/pdf",
        as_attachment=True,
    )


@bp.route("/status/<batch_id>")
def status(batch_id):
    """요청자(또는 누구나)가 계약 진행 상태를 확인하는 화면."""
    batch = get_batch(batch_id)
    if not batch:
        abort(404)
    return render_template("status.html", batch=batch)
