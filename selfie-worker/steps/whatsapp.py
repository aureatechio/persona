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

logger = logging.getLogger("worker.whatsapp")


DEFAULT_MESSAGE_TEMPLATE = "Olá, {name}! Obrigado pela sua mensagem!"
DEFAULT_PROPOSTA_TEMPLATE = (
    "{name}, segue minha proposta de governo completa para você conhecer melhor. "
    "Conto com seu apoio e compartilhamento!"
)


def _normalize_phone(phone: str) -> str:
    return phone if phone.startswith("55") else f"55{phone}"


def _official_enabled() -> bool:
    return bool(WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_IDS and WHATSAPP_VIDEO_TEMPLATE)


def _pick_phone_number_id() -> str:
    """Escolhe random um dos phone_number_ids configurados em
    WHATSAPP_PHONE_NUMBER_IDS. Distribui o load e reduz risco de
    rate limit/bloqueio por número."""
    if not WHATSAPP_PHONE_NUMBER_IDS:
        raise WhatsAppSendError("Nenhum WHATSAPP_PHONE_NUMBER_IDS configurado")
    return random.choice(WHATSAPP_PHONE_NUMBER_IDS)


def pick_provider() -> str:
    """Decide o canal de envio ('meta' ou 'uazapi') via random ponderado
    pelos pesos das envs WHATSAPP_META_WEIGHT e WHATSAPP_UAZAPI_WEIGHT.

    - meta_weight=0 força UAZAPI
    - uazapi_weight=0 força Meta
    - ambos 0 levanta WhatsAppSendError
    """
    meta = max(0, WHATSAPP_META_WEIGHT)
    uazapi = max(0, WHATSAPP_UAZAPI_WEIGHT)

    if meta <= 0 and uazapi <= 0:
        raise WhatsAppSendError(
            "Nenhum provider habilitado (WHATSAPP_META_WEIGHT e "
            "WHATSAPP_UAZAPI_WEIGHT estão zerados)"
        )
    if uazapi <= 0:
        return "meta"
    if meta <= 0:
        return "uazapi"

    return random.choices(["meta", "uazapi"], weights=[meta, uazapi])[0]


def send_video_official(phone: str, video_url: str) -> tuple[str, str]:
    """
    Envia o vídeo final via WhatsApp Business Cloud API usando o template
    aprovado pela Meta (header `video` com link parametrizado). Distribui
    entre N phone_number_ids configurados em WHATSAPP_PHONE_NUMBER_IDS,
    escolhendo random a cada chamada.

    Retorna (message_id, phone_number_id_usado). Levanta WhatsAppSendError
    em qualquer falha (rede, 4xx, 5xx, JSON inválido).
    """
    if not _official_enabled():
        raise WhatsAppSendError("Cloud API não configurada (faltam envs WHATSAPP_*)")

    phone = _normalize_phone(phone)
    phone_number_id = _pick_phone_number_id()

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
        "Sending WhatsApp video via Cloud API to %s (sender=%s, template=%s)...",
        phone, phone_number_id, WHATSAPP_VIDEO_TEMPLATE,
    )

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
        raise WhatsAppSendError(f"Cloud API network error (sender={phone_number_id}): {e}") from e

    if not resp.ok:
        body = resp.text[:400]
        logger.error(
            "Cloud API returned %d (sender=%s): %s",
            resp.status_code, phone_number_id, body,
        )
        raise WhatsAppSendError(
            f"Cloud API returned {resp.status_code} (sender={phone_number_id}): {body}"
        )

    try:
        data = resp.json()
    except ValueError:
        raise WhatsAppSendError(f"Cloud API returned invalid JSON: {resp.text[:200]}")

    messages = data.get("messages") or []
    if not messages or not messages[0].get("id"):
        raise WhatsAppSendError(f"Cloud API success without message id: {data}")

    msg_id = messages[0]["id"]
    logger.info(
        "Cloud API sent successfully (sender=%s, message_id=%s, to=%s)",
        phone_number_id, msg_id, phone,
    )
    return msg_id, phone_number_id


def send_whatsapp(
    phone: str,
    name: str,
    video_url: str,
    message_template: str | None = None,
    theme_label: str | None = None,
    slug: str | None = None,
):
    """
    Send the final video via UAZAPI WhatsApp.
    Sends EXACTLY ONCE — no retries to prevent duplicate messages.

    ``message_template`` vem do base_model (per-politician). Suporta
    substituições: ``{name}``, ``{tema}`` (label do tema escolhido pelo
    classifier) e ``{slug}`` (slug do candidato — usado em links de
    convite). Cai num default neutro quando vazio.
    """
    phone = _normalize_phone(phone)
    template = message_template or DEFAULT_MESSAGE_TEMPLATE
    text = (
        template
        .replace("{name}", name or "")
        .replace("{tema}", theme_label or "")
        .replace("{slug}", slug or "")
    )

    logger.info("Sending WhatsApp video to %s...", phone)

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
        # ConnectTimeout, ReadTimeout, ConnectionError, etc. SEM esse wrap, a
        # exceção vaza pelo bloco do worker e a linha fica em `sending` com
        # whatsapp_sent=true (já marcado pelo claim atômico), invisível pro
        # watchdog que filtra por whatsapp_sent IS NOT TRUE.
        raise WhatsAppSendError(f"UAZAPI network error: {e}") from e

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
        raise WhatsAppSendError(f"UAZAPI document network error: {e}") from e

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
