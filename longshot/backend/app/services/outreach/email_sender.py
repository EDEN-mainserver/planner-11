"""컴포넌트 5: Email Sender
Gmail SMTP로 발송. UI에서는 항상 dry_run=True로만 호출.
실제 발송은 worker.py의 승인된 작업에서만.

단독 실행:
    python -m app.services.outreach.email_sender --to me@example.com --dry-run
    python -m app.services.outreach.email_sender --to me@example.com --send
"""
from __future__ import annotations
import argparse
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import make_msgid

from app.core.config import settings


SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587


def build_message(
    to: str,
    subject: str,
    body_html: str,
    body_text: str | None = None,
    unsubscribe_token: str | None = None,
    sender_name: str | None = None,
    sender_email: str | None = None,
) -> EmailMessage:
    """수신거부 푸터를 자동 삽입한 MIME 메시지 생성"""
    sender_email = sender_email or settings.gmail_sender
    sender_name = sender_name or "에덴 마케팅"

    msg = EmailMessage()
    msg["From"] = f"{sender_name} <{sender_email}>"
    msg["To"] = to
    msg["Subject"] = subject
    msg["Message-ID"] = make_msgid(domain=sender_email.split("@")[-1])

    # 수신거부 푸터
    unsub_url = (
        f"{settings.vercel_public_url}/u/{unsubscribe_token}"
        if unsubscribe_token else f"{settings.vercel_public_url}/u/UNKNOWN"
    )
    footer_html = (
        f'<hr style="margin-top:32px;border:none;border-top:1px solid #eee">'
        f'<p style="color:#999;font-size:12px;margin-top:12px">'
        f'본 메일을 더 이상 받지 않으시려면 '
        f'<a href="{unsub_url}" style="color:#999">여기를 클릭</a>하세요.</p>'
    )
    footer_text = f"\n\n---\n본 메일 수신거부: {unsub_url}\n"

    body_text = body_text or ""
    msg.set_content(body_text + footer_text)
    msg.add_alternative(body_html + footer_html, subtype="html")

    # List-Unsubscribe 헤더 (Gmail 도달률 개선)
    msg["List-Unsubscribe"] = f"<{unsub_url}>"
    msg["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"

    return msg


def send(
    to: str,
    subject: str,
    body_html: str,
    body_text: str | None = None,
    unsubscribe_token: str | None = None,
    sender_name: str | None = None,
    sender_email: str | None = None,
    dry_run: bool = True,
) -> dict:
    """발송 (dry_run=True면 MIME만 반환)"""
    msg = build_message(
        to=to,
        subject=subject,
        body_html=body_html,
        body_text=body_text,
        unsubscribe_token=unsubscribe_token,
        sender_name=sender_name,
        sender_email=sender_email,
    )

    if dry_run:
        return {
            "status": "dry_run",
            "message_id": msg["Message-ID"],
            "mime_preview": msg.as_string()[:4000],
        }

    if not settings.gmail_app_password:
        return {
            "status": "failed",
            "error": "GMAIL_APP_PASSWORD 가 .env 에 설정되지 않았습니다",
        }

    sender_email = sender_email or settings.gmail_sender
    try:
        ctx = ssl.create_default_context()
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as server:
            server.starttls(context=ctx)
            server.login(sender_email, settings.gmail_app_password)
            resp = server.send_message(msg)
        return {
            "status": "sent",
            "message_id": msg["Message-ID"],
            "smtp_response": str(resp),
        }
    except Exception as e:
        return {
            "status": "failed",
            "message_id": msg["Message-ID"],
            "error": f"{type(e).__name__}: {e}",
        }


def _main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--to", required=True)
    parser.add_argument("--subject", default="[에덴 아웃리치] 테스트")
    parser.add_argument("--html", default="<p>안녕하세요, 테스트 메일입니다.</p>")
    parser.add_argument("--text", default="안녕하세요, 테스트 메일입니다.")
    parser.add_argument("--token", default="TEST_TOKEN")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--dry-run", action="store_true", default=True)
    group.add_argument("--send", dest="send_real", action="store_true")
    args = parser.parse_args()

    result = send(
        to=args.to,
        subject=args.subject,
        body_html=args.html,
        body_text=args.text,
        unsubscribe_token=args.token,
        dry_run=not args.send_real,
    )
    import json
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    _main()
