"""이메일 발송: Resend API(우선) → SMTP(폴백) → mock(콘솔)."""
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Resend API (HTTP 기반 — Render 등 SMTP 차단 환경에서 사용)
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")

# SMTP 설정 (로컬 등 SMTP 가능 환경용 폴백)
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER")
SMTP_PASS = os.environ.get("SMTP_PASS")
SENDER    = os.environ.get("SMTP_SENDER", SMTP_USER or "noreply@example.com")


def is_configured() -> bool:
    return bool(RESEND_API_KEY or (SMTP_USER and SMTP_PASS))


def _build_email_content(signer_name: str, doc_title: str, sign_url: str):
    from html import escape
    safe_name = escape(signer_name)
    safe_title = escape(doc_title)
    safe_url = escape(sign_url)

    subject = f"[E-Sign] {doc_title} 서명 요청"
    text = (
        f"{signer_name} 님,\n\n"
        f"'{doc_title}' 문서에 서명을 요청드립니다.\n"
        f"아래 링크에서 서명해주세요:\n{sign_url}\n"
    )
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#1a1a1a">서명 요청</h2>
      <p>{safe_name} 님,</p>
      <p><b>{safe_title}</b> 문서에 서명을 요청드립니다.</p>
      <p style="margin:24px 0">
        <a href="{safe_url}"
           style="background:#ffd400;color:#1a1a1a;padding:12px 24px;
                  border-radius:8px;text-decoration:none;font-weight:bold">
          서명하기
        </a>
      </p>
      <p style="font-size:12px;color:#888">버튼이 보이지 않으면 아래 링크를 복사해 주세요:<br>{safe_url}</p>
    </div>
    """
    return subject, text, html


def _send_via_resend(to_email, subject, html):
    import resend
    resend.api_key = RESEND_API_KEY
    r = resend.Emails.send({
        "from": f"E-Sign <{SENDER}>",
        "to": [to_email],
        "subject": subject,
        "html": html,
    })
    return True, f"resend:{r['id']}"


def _send_via_smtp(to_email, subject, text, html):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = SENDER
    msg["To"] = to_email
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as s:
        s.starttls()
        s.login(SMTP_USER, SMTP_PASS)
        s.sendmail(SENDER, [to_email], msg.as_string())
    return True, "smtp"


def send_signing_email(to_email: str, signer_name: str,
                       doc_title: str, sign_url: str) -> tuple[bool, str]:
    subject, text, html = _build_email_content(signer_name, doc_title, sign_url)

    if not is_configured():
        print("=" * 60)
        print(f"[EMAIL MOCK] to: {to_email}")
        print(f"[EMAIL MOCK] subject: {subject}")
        print(f"[EMAIL MOCK] sign_url: {sign_url}")
        print("=" * 60)
        return True, "mock"

    # 1순위: Resend API (HTTP, 클라우드 환경에서도 동작)
    if RESEND_API_KEY:
        try:
            return _send_via_resend(to_email, subject, html)
        except Exception as e:
            return False, f"resend-error: {e}"

    # 2순위: SMTP (로컬 환경)
    if SMTP_USER and SMTP_PASS:
        try:
            return _send_via_smtp(to_email, subject, text, html)
        except Exception as e:
            return False, f"smtp-error: {e}"

    return False, "no email provider configured"
