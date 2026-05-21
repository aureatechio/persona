"""Step 6: Send final video via WhatsApp.

Dois canais suportados:
  1. WhatsApp Business Cloud API (oficial — graph.facebook.com). Envia
     o vídeo via template aprovado pela Meta com header `video`.
     Preferido sempre que as envs WHATSAPP_* estão configuradas.
  2. UAZAPI (não-oficial — WhatsApp Web). Fallback automático quando a
     oficial falha por qualquer razão (token expirado, template rejected,
     timeout, etc.).
"""

import logging
import requests

from config import (
    UAZAPI_URL,
    UAZAPI_TOKEN,
    WHATSAPP_API_URL,
    WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_VIDEO_TEMPLATE,
    WHATSAPP_VIDEO_TEMPLATE_LANG,
)

logger = logging.getLogger("worker.whatsapp")


DEFAULT_MESSAGE_TEMPLATE = "Olá, {name}! Obrigado pela sua mensagem!"
DEFAULT_PROPOSTA_TEMPLATE = (
    "{name}, segue minha proposta de governo completa para você conhecer melhor. "
    "Conto com seu apoio e compartilhamento!"
)


def _normalize_phone(phone: str) -> str:
    return phone if phone.startswith("55") else f"55{phone}"


def _official_enabled() -> bool:
    return bool(WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_VIDEO_TEMPLATE)


def send_video_official(phone: str, video_url: str) -> str:
    """
    Envia o vídeo final via WhatsApp Business Cloud API usando o template
    aprovado pela Meta (header `video` com link parametrizado).

    Retorna o ``message_id`` retornado pela Meta. Levanta ``WhatsAppSendError``
    em qualquer falha (rede, 4xx, 5xx, JSON inválido).
    """
    if not _official_enabled():
        raise WhatsAppSendError("Cloud API não configurada (faltam envs WHATSAPP_*)")

    phone = _normalize_phone(phone)

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

    logger.info(
        "Sending WhatsApp video via Cloud API to %s (template=%s)...",
        phone, WHATSAPP_VIDEO_TEMPLATE,
    )

    try:
        resp = requests.post(
            f"{WHATSAPP_API_URL}/{WHATSAPP_PHONE_NUMBER_ID}/messages",
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
        body = resp.text[:400]
        logger.error("Cloud API returned %d: %s", resp.status_code, body)
        raise WhatsAppSendError(f"Cloud API returned {resp.status_code}: {body}")

    try:
        data = resp.json()
    except ValueError:
        raise WhatsAppSendError(f"Cloud API returned invalid JSON: {resp.text[:200]}")

    messages = data.get("messages") or []
    if not messages or not messages[0].get("id"):
        raise WhatsAppSendError(f"Cloud API success without message id: {data}")

    msg_id = messages[0]["id"]
    logger.info("Cloud API sent successfully to %s (message_id=%s)", phone, msg_id)
    return msg_id


def send_whatsapp(phone: str, name: str, video_url: str, message_template: str | None = None):
    """
    Send the final video via UAZAPI WhatsApp.
    Sends EXACTLY ONCE — no retries to prevent duplicate messages.

    ``message_template`` comes from the base_model (per-politician). Supports
    ``{name}`` substitution. Falls back to a neutral default when empty.
    """
    phone = _normalize_phone(phone)
    template = message_template or DEFAULT_MESSAGE_TEMPLATE
    text = template.replace("{name}", name)

    logger.info("Sending WhatsApp video to %s...", phone)

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
        logger.info("WhatsApp video sent successfully to %s (status: %d)", phone, resp.status_code)
    else:
        body = resp.text[:300]
        logger.error("UAZAPI returned %d: %s", resp.status_code, body)
        raise WhatsAppSendError(
            f"UAZAPI returned {resp.status_code}: {body}"
        )


def send_whatsapp_document(
    phone: str,
    name: str,
    pdf_url: str,
    message_template: str | None = None,
    doc_name: str = "proposta_de_governo.pdf",
):
    """
    Send a PDF document via UAZAPI WhatsApp (used for the "proposta de
    governo" attachment that follows the response video).

    Same EXACTLY-ONCE semantics as ``send_whatsapp``: do not retry on
    failure — duplicate documents would confuse the recipient.
    """
    phone = _normalize_phone(phone)
    template = message_template or DEFAULT_PROPOSTA_TEMPLATE
    text = template.replace("{name}", name)

    logger.info("Sending WhatsApp document to %s (doc: %s)...", phone, doc_name)

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

    if resp.ok:
        logger.info("WhatsApp document sent to %s (status: %d)", phone, resp.status_code)
    else:
        body = resp.text[:300]
        logger.error("UAZAPI document send returned %d: %s", resp.status_code, body)
        raise WhatsAppSendError(
            f"UAZAPI document send returned {resp.status_code}: {body}"
        )


class WhatsAppSendError(RuntimeError):
    """Raised when UAZAPI fails to send the message."""
    pass
