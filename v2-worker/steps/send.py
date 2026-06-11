"""V2 Step 6: Send final video via WhatsApp (Cloud API + UAZAPI)."""

import logging
import random
import requests

from config import (
    UAZAPI_URL,
    UAZAPI_TOKEN,
    WHATSAPP_API_URL,
    WHATSAPP_PHONE_NUMBER_IDS,
    WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_VIDEO_TEMPLATE,
    WHATSAPP_VIDEO_TEMPLATE_LANG,
    WHATSAPP_META_WEIGHT,
    WHATSAPP_UAZAPI_WEIGHT,
)

logger = logging.getLogger("v2-worker.send")

DEFAULT_MESSAGE_TEMPLATE = "Olá, {name}! Obrigado pela sua mensagem!"
DEFAULT_PROPOSTA_TEMPLATE = (
    "{name}, segue minha proposta de governo completa para você conhecer melhor. "
    "Conto com seu apoio e compartilhamento!"
)


class WhatsAppSendError(RuntimeError):
    pass


def _normalize_phone(phone: str) -> str:
    return phone if phone.startswith("55") else f"55{phone}"


def _official_enabled() -> bool:
    return bool(WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_IDS and WHATSAPP_VIDEO_TEMPLATE)


def pick_provider() -> str:
    """Decide channel ('meta' or 'uazapi') via weighted random."""
    meta = max(0, WHATSAPP_META_WEIGHT) if _official_enabled() else 0
    uazapi = max(0, WHATSAPP_UAZAPI_WEIGHT)

    if meta <= 0 and uazapi <= 0:
        raise WhatsAppSendError("Nenhum provider habilitado")
    if uazapi <= 0:
        return "meta"
    if meta <= 0:
        return "uazapi"

    return random.choices(["meta", "uazapi"], weights=[meta, uazapi])[0]


def send_video_official(phone: str, video_url: str) -> tuple[str, str]:
    """Send video via WhatsApp Business Cloud API."""
    if not _official_enabled():
        raise WhatsAppSendError("Cloud API não configurada")

    phone = _normalize_phone(phone)
    phone_number_id = random.choice(WHATSAPP_PHONE_NUMBER_IDS)

    payload = {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "template",
        "template": {
            "name": WHATSAPP_VIDEO_TEMPLATE,
            "language": {"code": WHATSAPP_VIDEO_TEMPLATE_LANG},
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
                }
            ],
        },
    }

    logger.info("Sending via Cloud API to %s (sender=%s)...", phone, phone_number_id)

    try:
        resp = requests.post(
            f"{WHATSAPP_API_URL}/{phone_number_id}/messages",
            headers={
                "Authorization": f"Bearer {WHATSAPP_ACCESS_TOKEN}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=60,
        )
    except requests.RequestException as e:
        raise WhatsAppSendError(f"Cloud API network error: {e}") from e

    if not resp.ok:
        raise WhatsAppSendError(f"Cloud API {resp.status_code}: {resp.text[:400]}")

    try:
        data = resp.json()
    except ValueError:
        raise WhatsAppSendError(f"Cloud API invalid JSON: {resp.text[:200]}")

    messages = data.get("messages") or []
    if not messages or not messages[0].get("id"):
        raise WhatsAppSendError(f"Cloud API no message id: {data}")

    msg_id = messages[0]["id"]
    logger.info("Cloud API sent (sender=%s, msg=%s)", phone_number_id, msg_id)
    return msg_id, phone_number_id


def send_whatsapp(phone: str, name: str, video_url: str, message_template: str | None = None):
    """Send video via UAZAPI WhatsApp."""
    phone = _normalize_phone(phone)
    template = message_template or DEFAULT_MESSAGE_TEMPLATE
    text = template.replace("{name}", name)

    logger.info("Sending UAZAPI video to %s...", phone)

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
                "text": text,
            },
            timeout=60,
        )
    except requests.RequestException as e:
        raise WhatsAppSendError(f"UAZAPI network error: {e}") from e

    if not resp.ok:
        raise WhatsAppSendError(f"UAZAPI {resp.status_code}: {resp.text[:300]}")

    logger.info("UAZAPI sent to %s (status: %d)", phone, resp.status_code)


def send_whatsapp_document(phone: str, name: str, pdf_url: str, message_template: str | None = None, doc_name: str = "proposta_de_governo.pdf"):
    """Send PDF document via UAZAPI."""
    phone = _normalize_phone(phone)
    template = message_template or DEFAULT_PROPOSTA_TEMPLATE
    text = template.replace("{name}", name)

    logger.info("Sending UAZAPI document to %s...", phone)

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
                "type": "document",
                "file": pdf_url,
                "text": text,
                "docName": doc_name,
            },
            timeout=60,
        )
    except requests.RequestException as e:
        raise WhatsAppSendError(f"UAZAPI document error: {e}") from e

    if not resp.ok:
        raise WhatsAppSendError(f"UAZAPI document {resp.status_code}: {resp.text[:300]}")

    logger.info("UAZAPI document sent to %s", phone)
