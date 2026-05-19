"""Fire-and-forget delivery of terminal-status callbacks to external systems.

The pipeline never blocks on webhook success: delivery failure is logged and
flagged via `webhook_delivered_at` (left NULL on failure) so an out-of-band
job can retry if needed, but the supia row is already in its terminal state.
"""

import logging
import requests

logger = logging.getLogger("worker.webhook")

REQUEST_TIMEOUT = 10
MAX_ATTEMPTS = 3


def deliver(webhook_url: str, payload: dict) -> bool:
    """POST `payload` as JSON to `webhook_url`. Returns True on 2xx."""
    last_error: str | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            r = requests.post(webhook_url, json=payload, timeout=REQUEST_TIMEOUT)
            if 200 <= r.status_code < 300:
                logger.info("Webhook delivered (attempt %d) → %s", attempt, r.status_code)
                return True
            last_error = f"HTTP {r.status_code}: {r.text[:200]}"
            logger.warning("Webhook attempt %d/%d failed: %s", attempt, MAX_ATTEMPTS, last_error)
        except requests.RequestException as e:
            last_error = str(e)
            logger.warning("Webhook attempt %d/%d error: %s", attempt, MAX_ATTEMPTS, last_error)

    logger.error("Webhook delivery exhausted after %d attempts: %s", MAX_ATTEMPTS, last_error)
    return False
