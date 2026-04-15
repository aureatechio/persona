"""Step 6: Send final video via WhatsApp (UAZAPI)."""

import logging
import requests

from config import UAZAPI_URL, UAZAPI_TOKEN

logger = logging.getLogger("worker.whatsapp")


DEFAULT_MESSAGE_TEMPLATE = "Olá, {name}! Obrigado pela sua mensagem!"


def send_whatsapp(phone: str, name: str, video_url: str, message_template: str | None = None):
    """
    Send the final video via UAZAPI WhatsApp.
    Sends EXACTLY ONCE — no retries to prevent duplicate messages.

    ``message_template`` comes from the base_model (per-politician). Supports
    ``{name}`` substitution. Falls back to a neutral default when empty.
    """
    # Ensure country code
    if not phone.startswith("55"):
        phone = f"55{phone}"

    template = message_template or DEFAULT_MESSAGE_TEMPLATE
    text = template.replace("{name}", name)

    logger.info("Sending WhatsApp to %s...", phone)

    resp = requests.post(
        f"{UAZAPI_URL}/send/media",
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "token": UAZAPI_TOKEN,
        },
        json={
            "number": phone,
            "type": "video",
            "file": video_url,
            "text": text,
        },
        timeout=60,
    )

    if resp.ok:
        logger.info("WhatsApp sent successfully to %s (status: %d)", phone, resp.status_code)
    else:
        body = resp.text[:300]
        logger.error("UAZAPI returned %d: %s", resp.status_code, body)
        raise WhatsAppSendError(
            f"UAZAPI returned {resp.status_code}: {body}"
        )


class WhatsAppSendError(RuntimeError):
    """Raised when UAZAPI fails to send the message."""
    pass
