"""Step 6: Send final video via WhatsApp (Meta Business API — template message)."""

import logging
import requests

from config import META_WHATSAPP_TOKEN, META_PHONE_NUMBER_ID

logger = logging.getLogger("worker.whatsapp")

META_API_URL = f"https://graph.facebook.com/v22.0/{META_PHONE_NUMBER_ID}/messages"


def send_whatsapp(phone: str, name: str, video_url: str):
    """
    Send the final video via Meta WhatsApp Business API using template 'videoduda2'.
    Sends EXACTLY ONCE — no retries to prevent duplicate messages.
    """
    if not phone.startswith("55"):
        phone = f"55{phone}"

    logger.info("Sending WhatsApp to %s via Meta API...", phone)

    resp = requests.post(
        META_API_URL,
        headers={
            "Authorization": f"Bearer {META_WHATSAPP_TOKEN}",
            "Content-Type": "application/json",
        },
        json={
            "messaging_product": "whatsapp",
            "to": phone,
            "type": "template",
            "template": {
                "name": "videoduda2",
                "language": {"code": "pt_BR"},
                "components": [
                    {
                        "type": "header",
                        "parameters": [
                            {
                                "type": "video",
                                "parameter_name": "video_header",
                                "video": {"link": video_url},
                            }
                        ],
                    },
                    {
                        "type": "body",
                        "parameters": [
                            {
                                "type": "text",
                                "parameter_name": "nome",
                                "text": name,
                            }
                        ],
                    },
                ],
            },
        },
        timeout=60,
    )

    if resp.ok:
        logger.info("Meta API: WhatsApp sent to %s (status: %d)", phone, resp.status_code)
    else:
        logger.error("Meta API returned %d: %s", resp.status_code, resp.text[:300])
