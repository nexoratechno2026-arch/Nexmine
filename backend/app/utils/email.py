import logging
import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.config import settings

logger = logging.getLogger(__name__)


async def send_password_reset_email(to_email: str, reset_token: str, full_name: str = "there"):
    reset_url = f"{settings.frontend_url}/reset-password?token={reset_token}"

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: 'Inter', sans-serif; background: #0A0F1E; color: #e2e8f0; margin: 0; padding: 0; }}
        .container {{ max-width: 560px; margin: 40px auto; background: #111827; border-radius: 16px; padding: 40px; border: 1px solid rgba(99,102,241,0.2); }}
        .logo {{ font-size: 24px; font-weight: 700; background: linear-gradient(135deg, #6366F1, #10B981); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 32px; }}
        h1 {{ font-size: 22px; color: #f1f5f9; margin-bottom: 16px; }}
        p {{ color: #94a3b8; line-height: 1.6; margin-bottom: 24px; }}
        .btn {{ display: inline-block; background: linear-gradient(135deg, #6366F1, #4F46E5); color: #fff !important; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 600; font-size: 15px; }}
        .note {{ font-size: 12px; color: #64748b; margin-top: 32px; }}
        .url {{ word-break: break-all; color: #6366F1; font-size: 12px; margin-top: 12px; }}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">⬡ Nex Mine</div>
        <h1>Reset your password</h1>
        <p>Hi {full_name},<br>We received a request to reset your Nex Mine password. Click the button below — this link expires in <strong>1 hour</strong>.</p>
        <a href="{reset_url}" class="btn">Reset Password</a>
        <p class="note">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
        <p class="url">Or copy this link: {reset_url}</p>
      </div>
    </body>
    </html>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Reset your Nex Mine password"
    msg["From"] = settings.smtp_from
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user,
            password=settings.smtp_pass,
            start_tls=settings.smtp_starttls,
        )
        logger.info(f"Password reset email sent to {to_email}")
    except Exception as e:
        logger.error(f"Failed to send reset email to {to_email}: {e}")
        # Surface the reset URL in logs so devs can test without SMTP in dev
        logger.warning(f"[DEV] Password reset URL for {to_email}: {reset_url}")
        raise
