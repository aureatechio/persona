"""Step 6: Send final video via WhatsApp (UAZAPI)."""

import logging
import requests

from config import UAZAPI_URL, UAZAPI_TOKEN

logger = logging.getLogger("worker.whatsapp")


DEFAULT_MESSAGE_TEMPLATE = "Olá, {name}! Obrigado pela sua mensagem!"
DEFAULT_PROPOSTA_TEMPLATE = (
    "{name}, segue minha proposta de governo completa para você conhecer melhor. "
    "Conto com seu apoio e compartilhamento!"
)


def _normalize_phone(phone: str) -> str:
    return phone if phone.startswith("55") else f"55{phone}"


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
