import logging
import threading
import json
import os
import requests
from django.conf import settings

logger = logging.getLogger("apps")

KAPSO_API_BASE = "https://api.kapso.ai/meta/whatsapp/v24.0"


def _send_via_api(phone, text=None, template_payload=None):
    """Internal: send WhatsApp message via Kapso REST API."""
    api_key = getattr(settings, "KAPSO_API_KEY", None)
    phone_id = getattr(settings, "KAPSO_PHONE_ID", None)

    if not api_key or not phone_id:
        logger.warning("Kapso API Key or Phone ID is not set. WhatsApp message dropped.")
        return

    url = f"{KAPSO_API_BASE}/{phone_id}/messages"
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": api_key,
    }

    if template_payload:
        payload = template_payload
        logger.info(f"Sending WhatsApp Template to {phone}...")
    else:
        payload = {
            "messaging_product": "whatsapp",
            "to": phone.lstrip("+"),
            "type": "text",
            "text": {"body": text},
        }
        logger.info(f"Sending WhatsApp text to {phone}...")

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=15)
        if response.status_code == 200:
            logger.info(f"WhatsApp sent successfully to {phone}")
        else:
            logger.error(
                f"Failed to send WhatsApp to {phone}: "
                f"[{response.status_code}] {response.text}"
            )
    except Exception as e:
        logger.error(f"Error sending WhatsApp via Kapso API: {e}")


def send_whatsapp_message(phone, text):
    """
    Send a free-form text message via WhatsApp.
    Only works if the recipient has messaged the business number
    in the last 24 hours.
    """
    if not phone:
        return
    phone = phone.replace(" ", "")
    if not phone.startswith("+"):
        phone = f"+{phone}"

    thread = threading.Thread(
        target=_send_via_api, kwargs={"phone": phone, "text": text}, daemon=True
    )
    thread.start()


def send_whatsapp_template(phone, template_name, named_params=None, language_code="en_US"):
    """
    Send a template message via WhatsApp (works outside the 24-hour window).

    Args:
        phone: Recipient phone number with country code (e.g. "+201017129613")
        template_name: Name of the approved template (e.g. "test2")
        named_params: dict of parameter names → values, e.g.
                      {"name": "Hesham", "order_id": "ORD-1234", "product": "Sticker"}
        language_code: Template language code (default "en_US")
    """
    if not phone:
        return
    phone = phone.replace(" ", "")
    if not phone.startswith("+"):
        phone = f"+{phone}"

    payload = {
        "messaging_product": "whatsapp",
        "to": phone.lstrip("+"),
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": language_code},
        },
    }

    if named_params:
        payload["template"]["components"] = [
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "parameter_name": key, "text": str(value)}
                    for key, value in named_params.items()
                ],
            }
        ]

    thread = threading.Thread(
        target=_send_via_api,
        kwargs={"phone": phone, "template_payload": payload},
        daemon=True,
    )
    thread.start()
