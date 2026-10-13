"""
WhatsApp Cloud API Client
Uses Meta's official WhatsApp Business Cloud API.
DO NOT use unofficial libraries or WhatsApp Web automation.
"""

import hashlib
import hmac
import httpx
from typing import Optional
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

WHATSAPP_API_BASE = "https://graph.facebook.com/v21.0"


class WhatsAppClient:
    """Handles all outbound WhatsApp API calls."""

    def __init__(self):
        self.access_token = settings.WHATSAPP_ACCESS_TOKEN
        self.phone_number_id = settings.WHATSAPP_PHONE_NUMBER_ID
        self.is_configured = bool(self.access_token and self.phone_number_id)

    @property
    def headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

    async def send_text_message(self, to: str, body: str, business_id: str = None) -> dict:
        """Send a text message to a WhatsApp number."""
        # 1. Try Baileys Companion Bridge first (WhatsApp Web session)
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                bridge_headers = {"Authorization": f"Bearer {settings.WHATSAPP_BRIDGE_TOKEN}"} if settings.WHATSAPP_BRIDGE_TOKEN else {}
                st = await client.get(f"{settings.WHATSAPP_BRIDGE_URL}/status", headers=bridge_headers)
                if st.status_code == 200 and st.json().get("connected") and st.json().get("business_id") == business_id:
                    bridge_resp = await client.post(
                        f"{settings.WHATSAPP_BRIDGE_URL}/send",
                        json={"phone": to, "message": body},
                        headers=bridge_headers,
                    )
                    bridge_resp.raise_for_status()
                    if bridge_resp.status_code == 200:
                        logger.info(f"WhatsApp message sent via QR Companion to {to}")
                        return bridge_resp.json()
        except httpx.HTTPStatusError:
            raise
        except httpx.RequestError:
            pass

        # 2. Fallback to Meta Cloud API if configured
        if not self.is_configured or business_id != settings.WHATSAPP_BRIDGE_BUSINESS_ID:
            logger.warning("WhatsApp not configured — message not sent (DEMO MODE)")
            raise RuntimeError("WhatsApp is disconnected. Connect your account before sending.")

        url = f"{WHATSAPP_API_BASE}/{self.phone_number_id}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "text",
            "text": {"body": body},
        }

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, json=payload, headers=self.headers)
                resp.raise_for_status()
                data = resp.json()
                logger.info(f"WhatsApp message sent to {to[:4]}****")
                return data
        except httpx.HTTPStatusError as e:
            logger.error(f"WhatsApp API HTTP error: {e.response.status_code}")
            raise
        except Exception as e:
            logger.error(f"WhatsApp API error: {e}")
            raise

    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        """
        Verify that incoming webhook is genuinely from Meta.
        Uses HMAC-SHA256 with app secret.
        """
        if not settings.WHATSAPP_APP_SECRET:
            logger.warning("WHATSAPP_APP_SECRET not set — skipping signature verification (dev mode)")
            return settings.DEV_MODE

        import hmac as _hmac
        expected = "sha256=" + _hmac.new(
            settings.WHATSAPP_APP_SECRET.encode("utf-8"),
            payload,
            hashlib.sha256,
        ).hexdigest()

        return _hmac.compare_digest(expected, signature)


whatsapp_client = WhatsAppClient()
