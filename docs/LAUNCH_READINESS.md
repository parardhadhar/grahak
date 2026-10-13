# Grahak: implementation and launch notes

## Implemented and verified

- Reference-led landing page: warm black, copper accents, ivory serif display type, sandstone imagery.
- User-supplied hero video, muted looping playback, pause/play control, and a reduced-motion poster fallback.
- Animated headline entrance, spring-based hero interaction, section reveals, and an interactive scroll-driven workspace walkthrough.
- Consistent CRM styling, responsive navigation, mobile conversation/back navigation, and accessible customer details on narrow screens.
- Restored auth/onboarding/search/customer styles that previously referenced missing tokens and component classes.
- Inbox loads all contact pages, polls for new messages, preserves multiline message text, and handles failed sends without recording fictitious messages.
- Customer pagination and mobile customer rows; search request ordering and debounce cleanup.
- Notes and follow-ups verified in an isolated QA database.
- Browser timestamps preserve UTC instants; follow-up input converts local dates to ISO timestamps.
- Bridge management uses authenticated backend routes rather than browser calls to a fixed localhost port.
- Bridge callbacks require a shared token and an explicit workspace mapping. Incoming messages cannot fall back to an arbitrary business.
- Message idempotency covers repeated webhook deliveries and outgoing echoes.
- Received bridge messages are persisted to a local outbox until the backend acknowledges them; temporary reconnects preserve pairing credentials.
- WhatsApp LID identities resolve to phone identities where available. Groups and status broadcasts are excluded from this direct-customer CRM.
- Groq uses an asynchronous client with bounded timeout, retries, and local fallback during provider outages.
- Existing Nexus workspace connected successfully; live incoming messages persisted and Groq processing completed. No test messages were sent to customers.

## Run locally

Backend, from `backend`:

```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Bridge, from `whatsapp-bridge`:

```powershell
npm start
```

Frontend, from `frontend`:

```powershell
npm run dev
```

For a new local bridge workspace, list workspaces and configure the selected one:

```powershell
cd backend
python configure_bridge.py
python configure_bridge.py --business-id YOUR_BUSINESS_ID
python configure_bridge.py --status
```

The configuration helper validates the workspace, preserves an existing shared token, and writes matching backend/bridge environment values without printing secrets. Restart both services after changing configuration. Pair from the app if a saved WhatsApp session is unavailable.

## Verification

Latest completed checks: frontend production build and lint passed; 23 backend tests passed; the bridge persistence test and JavaScript syntax check passed. Mobile browser checks covered customer details, note creation, follow-up creation, and inbox back navigation. Video pause/play and the pinned story's chapter transitions were checked in the browser.

```powershell
cd frontend
npm run build

cd ../backend
python -m pytest tests -q -p no:cacheprovider

cd ../whatsapp-bridge
npm test
npm run check
```

Backend tests are isolated from live customer databases and external AI. Bridge tests verify that failed delivery survives a restart and is removed only after acknowledgement. The frontend production build includes TypeScript validation.

## Remaining deployment work

This is running locally, not deployed. Public launch still requires hosted frontend/backend/bridge processes, HTTPS, environment variables on the host, persistent session/outbox storage, database backups, and a final test on the deployed domain. Set `DEV_MODE=false` and a strong `SECRET_KEY` before public launch; configure `FRONTEND_URL` and the public frontend API URL.

The companion bridge supports one configured WhatsApp account/workspace per process. Serving multiple businesses requires separate bridge instances or an additional account-session architecture. Meta Cloud API remains an alternative transport with explicit business mapping and signature verification.

Current outbound composer sends text. Received non-text items appear as descriptions/captions; media uploading, audio recording, attachment playback, billing, and automated reminder delivery are separate features. Follow-ups are scheduled and managed in the CRM; they do not automatically send messages to customers.

The hero video and product artwork are illustrations. The walkthrough screenshot is captured from the actual CRM with clearly identified example data.
