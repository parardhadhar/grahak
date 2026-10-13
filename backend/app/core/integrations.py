from app.core.config import settings
from app.core.logging import get_logger
import httpx

logger = get_logger(__name__)


async def get_whatsapp_status(business_id: str) -> dict:
    """Report this workspace's live pairing state, separately from configuration."""
    configured = bool(
        settings.WHATSAPP_ACCESS_TOKEN and settings.WHATSAPP_PHONE_NUMBER_ID
    ) and business_id == settings.WHATSAPP_BRIDGE_BUSINESS_ID
    if business_id == settings.WHATSAPP_BRIDGE_BUSINESS_ID and settings.WHATSAPP_BRIDGE_TOKEN:
        try:
            async with httpx.AsyncClient(timeout=2) as client:
                response = await client.get(f'{settings.WHATSAPP_BRIDGE_URL}/status', headers={'Authorization': f'Bearer {settings.WHATSAPP_BRIDGE_TOKEN}'})
                response.raise_for_status()
                data = response.json()
                if data.get('business_id') == business_id:
                    return {'connected': bool(data.get('connected')), 'mode': 'CONNECTED' if data.get('connected') else 'DISCONNECTED', 'phone': data.get('phone'), 'pending_messages': data.get('pending_messages', 0)}
        except httpx.HTTPError:
            pass
    return {
        "connected": False,
        "configured": configured,
        "mode": "CLOUD_CONFIGURED" if configured else "DISCONNECTED",
        "phone_number_id": settings.WHATSAPP_PHONE_NUMBER_ID if configured else None,
    }


def get_ai_status() -> dict:
    """Returns whether Groq AI is configured."""
    configured = bool(settings.GROQ_API_KEY)
    return {
        "available": configured,
        "provider": "groq" if configured else "none",
        "model": settings.GROQ_MODEL if configured else None,
    }
