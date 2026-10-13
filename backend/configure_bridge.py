"""List workspaces or bind the local WhatsApp bridge to one workspace."""
import argparse
import asyncio
import secrets
from pathlib import Path
from dotenv import dotenv_values, set_key
from sqlalchemy import select
from app.db.database import AsyncSessionLocal, engine
from app.models.models import Business

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--business-id')
    parser.add_argument('--status', action='store_true')
    args = parser.parse_args()
    if args.status:
        import httpx
        from app.core.config import settings
        response = httpx.get(f'{settings.WHATSAPP_BRIDGE_URL}/status', headers={'Authorization': f'Bearer {settings.WHATSAPP_BRIDGE_TOKEN}'})
        response.raise_for_status()
        data = response.json()
        print(f"Connected: {bool(data.get('connected'))}; pending messages: {data.get('pending_messages', 0)}; assigned workspace: {data.get('business_id')}")
        await engine.dispose()
        return
    async with AsyncSessionLocal() as db:
        businesses = (await db.execute(select(Business.id, Business.name))).all()
    await engine.dispose()
    if not args.business_id:
        for business in businesses:
            print(f'{business.id}  {business.name}')
        return
    if args.business_id not in {business.id for business in businesses}:
        raise SystemExit('Unknown business ID. Run without arguments to list workspaces.')
    backend_env = Path(__file__).parent / '.env'
    bridge_env = Path(__file__).parent.parent / 'whatsapp-bridge' / '.env'
    existing = dotenv_values(backend_env)
    token = existing.get('WHATSAPP_BRIDGE_TOKEN') or secrets.token_urlsafe(32)
    set_key(str(backend_env), 'WHATSAPP_BRIDGE_TOKEN', token)
    set_key(str(backend_env), 'WHATSAPP_BRIDGE_BUSINESS_ID', args.business_id)
    set_key(str(backend_env), 'WHATSAPP_BRIDGE_URL', 'http://127.0.0.1:5001')
    set_key(str(bridge_env), 'WHATSAPP_BRIDGE_TOKEN', token)
    set_key(str(bridge_env), 'BUSINESS_ID', args.business_id)
    set_key(str(bridge_env), 'FASTAPI_URL', 'http://127.0.0.1:8000')
    print('Bridge configuration saved. Restart the backend and run npm start in whatsapp-bridge.')

if __name__ == '__main__':
    asyncio.run(main())
