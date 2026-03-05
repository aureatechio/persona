"""Step 6: Send final video via WhatsApp (UAZAPI)."""

import time
import logging
import requests

from config import UAZAPI_URL, UAZAPI_TOKEN

logger = logging.getLogger("worker.whatsapp")

MAX_RETRIES = 3


def send_whatsapp(phone: str, name: str, video_url: str):
    """
    Send the final video via UAZAPI WhatsApp.
    Retries up to MAX_RETRIES times with backoff.
    """
    # Ensure country code
    if not phone.startswith("55"):
        phone = f"55{phone}"

    last_error = ""

    for attempt in range(1, MAX_RETRIES + 1):
        logger.info("WhatsApp send attempt %d/%d to %s", attempt, MAX_RETRIES, phone)

        try:
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
                timeout=30,
            )

            if resp.ok:
                logger.info("WhatsApp sent successfully to %s", phone)
                return
            else:
                last_error = resp.text
                logger.warning("UAZAPI error (attempt %d): %s %s", attempt, resp.status_code, last_error[:200])

        except requests.RequestException as e:
            last_error = str(e)
            logger.warning("UAZAPI request error (attempt %d): %s", attempt, last_error)

        if attempt < MAX_RETRIES:
            wait = attempt * 5
            logger.info("Waiting %ds before retry...", wait)
            time.sleep(wait)

    raise RuntimeError(f"WhatsApp send failed after {MAX_RETRIES} attempts: {last_error}")
