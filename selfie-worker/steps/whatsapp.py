"""Step 6: Send final video via WhatsApp (UAZAPI)."""

import logging
import requests

from config import UAZAPI_URL, UAZAPI_TOKEN

logger = logging.getLogger("worker.whatsapp")


def send_whatsapp(phone: str, name: str, video_url: str):
    """
    Send the final video via UAZAPI WhatsApp.
    Sends EXACTLY ONCE — no retries to prevent duplicate messages.
    """
    # Ensure country code
    if not phone.startswith("55"):
        phone = f"55{phone}"

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
            "text": f"Olá {name}! Aqui está seu vídeo personalizado do evento!",
        },
        timeout=60,
    )

    if resp.ok:
        logger.info("WhatsApp sent successfully to %s (status: %d)", phone, resp.status_code)
    else:
        # Log but do NOT retry — UAZAPI may have sent the message even on error
        logger.error("UAZAPI returned %d: %s (message may have been sent anyway)", resp.status_code, resp.text[:300])
