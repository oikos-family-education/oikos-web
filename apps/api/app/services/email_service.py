"""Outbound email — provider-agnostic shim.

In production this would call Resend (configured via EMAIL_PROVIDER / RESEND_API_KEY in
settings). In dev and tests it logs the email payload so flows are testable without
network access.
"""
import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_email(*, to: str, subject: str, html: str, text: Optional[str] = None) -> None:
    """Send an email. Falls back to logging in dev / when no provider is configured."""
    if not settings.RESEND_API_KEY:
        logger.info(
            "[email:dev] to=%s subject=%r text=%r html_len=%d",
            to,
            subject,
            text,
            len(html or ""),
        )
        return

    # Lazy import so dev / test environments don't need the `resend` package.
    try:
        import resend  # type: ignore
    except ImportError:
        logger.warning("RESEND_API_KEY set but `resend` package not installed — logging instead")
        logger.info("[email:fallback] to=%s subject=%r", to, subject)
        return

    resend.api_key = settings.RESEND_API_KEY
    resend.Emails.send(
        {
            "from": settings.EMAIL_FROM_ADDRESS,
            "to": [to],
            "subject": subject,
            "html": html,
            "text": text or "",
        }
    )


def render_beta_invite_email(*, first_name: str, invite_url: str) -> tuple[str, str, str]:
    """Returns (subject, html, text)."""
    subject = "You're in — welcome to the Oikos closed beta"
    text = (
        f"Hi {first_name},\n\n"
        "Great news — you've been accepted into the Oikos closed beta. "
        "Create your account here:\n\n"
        f"{invite_url}\n\n"
        "This invite is valid for 30 days.\n\n"
        "Welcome aboard,\n"
        "The Oikos team"
    )
    html = f"""<!doctype html>
<html><body style="font-family: -apple-system, system-ui, sans-serif; color:#1f2937; max-width:560px; margin:0 auto; padding:24px;">
  <h1 style="color:#0d9488; font-size:24px;">You're in!</h1>
  <p>Hi {first_name},</p>
  <p>Great news — you've been accepted into the <strong>Oikos closed beta</strong>. We're thrilled to have you.</p>
  <p>Click below to create your account and start using Oikos:</p>
  <p style="margin:32px 0;">
    <a href="{invite_url}"
       style="background:#0d9488; color:white; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600;">
      Create your account
    </a>
  </p>
  <p style="color:#6b7280; font-size:14px;">This invite is valid for 30 days. If the button doesn't work, paste this URL into your browser: {invite_url}</p>
  <p style="margin-top:32px;">Welcome aboard,<br><strong>The Oikos team</strong></p>
</body></html>"""
    return subject, html, text
