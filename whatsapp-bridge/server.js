const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const { createOutbox } = require('./outbox');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  normalizeMessageContent,
} = require('@whiskeysockets/baileys');

const app = express();
const PORT = process.env.PORT || 5001;
const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
const BRIDGE_TOKEN = process.env.WHATSAPP_BRIDGE_TOKEN;
const BUSINESS_ID = process.env.BUSINESS_ID;
app.use((req, res, next) => {
  if (!BRIDGE_TOKEN || req.headers.authorization !== `Bearer ${BRIDGE_TOKEN}`) return res.status(403).json({ error: 'Invalid bridge credentials' });
  next();
});
axios.defaults.headers.common.Authorization = `Bearer ${BRIDGE_TOKEN}`;
axios.defaults.timeout = 15000;
const outbox = createOutbox(path.join(__dirname, 'pending-messages.json'), payload => axios.post(`${FASTAPI_URL}/api/v1/webhook/bridge`, payload, { timeout: 45000 }));
setInterval(() => void outbox.flush(), 5000).unref();
app.use(express.json());

const AUTH_DIR = path.join(__dirname, 'auth_info_baileys');
if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

let sock = null;
let currentQR = null;
let currentQRImage = null;
let isConnected = false;
let userPhone = null;
let userName = null;
let consecutiveDisconnects = 0;
let reconnectTimer = null;
let initializing = false;

function scheduleReconnect(delay) {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(initWhatsApp, delay);
}

const logger = pino({ level: 'error' });
// Recover status synchronization when the backend restarts after the bridge.
setInterval(() => {
  axios.post(`${FASTAPI_URL}/api/v1/webhook/bridge/status`, {
    connected: isConnected,
    phone: isConnected ? userPhone : null,
    name: isConnected ? userName : null,
  }, { timeout: 3000 }).catch(() => {});
}, 15000).unref();

async function initWhatsApp() {
  if (initializing) return;
  initializing = true;
  try {
    if (sock) { sock.ev.removeAllListeners(); sock.end(new Error('Reconnecting')); sock = null; }
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      auth: state,
      logger,
      printQRInTerminal: false,
      browser: ['Grahak CRM', 'Desktop', '1.0.0'],
      syncFullHistory: true,
      shouldIgnoreJid: jid => jid === 'status@broadcast' || jid.endsWith('@g.us'),
      connectTimeoutMs: 60000,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        currentQR = qr;
        try {
          currentQRImage = await qrcode.toDataURL(qr, { width: 320, margin: 2 });
          console.log('⚡ New WhatsApp QR Code generated for pairing');
        } catch (e) {
          console.error('Error generating QR image:', e);
        }
      }

      if (connection === 'open') {
        isConnected = true;
        consecutiveDisconnects = 0;
        currentQR = null;
        currentQRImage = null;

        const userJid = sock.user?.id || '';
        userPhone = userJid.split('@')[0].split(':')[0];
        userName = sock.user?.name || 'Grahak Business';

        console.log(`✅ WhatsApp Connected successfully! Phone: +${userPhone}`);

        // Notify FastAPI backend
        try {
          await axios.post(`${FASTAPI_URL}/api/v1/webhook/bridge/status`, {
            connected: true,
            phone: userPhone,
            name: userName,
          });
        } catch (err) {
          console.warn('FastAPI status notification note:', err.message);
        }
      }

      if (connection === 'close') {
        isConnected = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        consecutiveDisconnects++;

        console.log(`Connection closed (status: ${statusCode}, consecutive: ${consecutiveDisconnects})`);

        // Notify FastAPI backend
        try {
          await axios.post(`${FASTAPI_URL}/api/v1/webhook/bridge/status`, {
            connected: false,
            phone: null,
          });
        } catch {}

        if (statusCode === DisconnectReason.loggedOut) {
          console.log(`🔄 Resetting credentials (status: ${statusCode}, consecutive: ${consecutiveDisconnects}). Preparing fresh QR...`);
          try {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
            fs.mkdirSync(AUTH_DIR, { recursive: true });
          } catch (e) {}
          currentQR = null;
          currentQRImage = null;
          userPhone = null;
          userName = null;
          consecutiveDisconnects = 0;
          scheduleReconnect(1500);
        } else {
          scheduleReconnect(Math.min(30000, 3000 * consecutiveDisconnects));
        }
      }
    });



function extractMessageBody(msg) {
  if (!msg || !msg.message) return '';
  const m = normalizeMessageContent(msg.message) || {};
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    (m.imageMessage ? '[Photo]' : '') ||
    m.videoMessage?.caption ||
    (m.videoMessage ? '[Video]' : '') ||
    (m.audioMessage ? '[Voice Note]' : '') ||
    (m.documentMessage ? `[Document: ${m.documentMessage.fileName || 'file'}]` : '') ||
    (m.stickerMessage ? '[Sticker]' : '') ||
    (m.contactMessage ? `[Contact Card: ${m.contactMessage.displayName || ''}]` : '') ||
    (m.locationMessage ? '[Location]' : '') ||
    m.buttonsResponseMessage?.selectedDisplayText ||
    m.templateButtonReplyMessage?.selectedDisplayText ||
    m.listResponseMessage?.title ||
    m.interactiveResponseMessage?.body?.text ||
    ''
  );
}

function extractPhone(remoteJid) {
  if (!remoteJid) return '';
  const clean = remoteJid.split('@')[0].split(':')[0];
  return clean.replace(/\D/g, '');
}

async function resolvePhoneJid(msg) {
  const jid = msg.key?.remoteJid || '';
  if (jid.endsWith('@s.whatsapp.net')) return jid;
  if (!jid.endsWith('@lid')) return null;
  if (msg.key.remoteJidAlt?.endsWith('@s.whatsapp.net')) return msg.key.remoteJidAlt;
  return await sock.signalRepository.lidMapping.getPNForLID(jid);
}

    // ── INCOMING & OUTBOUND MESSAGES LISTENER ─────────────────
    sock.ev.on('messages.upsert', async (m) => {
      try {
        const { messages } = m;
        if (!messages || messages.length === 0) return;

        for (const msg of messages) {
          if (!msg.key) continue;
          const remoteJid = msg.key.remoteJid || '';
          if (remoteJid === 'status@broadcast') continue;
          const phoneJid = await resolvePhoneJid(msg);
          if (!phoneJid) continue;

          const whatsappNumber = extractPhone(phoneJid);
          if (!whatsappNumber) continue;

          const customerName = msg.pushName || null;
          const msgId = msg.key.id;
          const isFromMe = Boolean(msg.key.fromMe);
          const body = extractMessageBody(msg);

          if (!body.trim()) continue;

          // Message bodies stay in the CRM database, not process logs.

          // Forward to Grahak FastAPI webhook
          try {
            outbox.enqueue({
              whatsapp_number: whatsappNumber,
              customer_name: customerName,
              message_body: body,
              whatsapp_message_id: msgId,
              direction: isFromMe ? 'outbound' : 'inbound',
              business_id: BUSINESS_ID,
              timestamp: Number(msg.messageTimestamp) || null,
              is_history: m.type !== 'notify' || Number(msg.messageTimestamp) < Date.now() / 1000 - 86400,
            });
          } catch (apiErr) {
            console.error('Error forwarding message to Grahak backend:', apiErr.message);
          }
        }
      } catch (err) {
        console.error('Error in messages.upsert handler:', err);
      }
    });

    // ── CHAT HISTORY SYNC LISTENER ────────────────────────
    sock.ev.on('messaging-history.set', async ({ chats, contacts, messages }) => {
      try {
        console.log(`📥 Received WhatsApp history sync: ${chats?.length || 0} chats, ${messages?.length || 0} messages`);
        if (!messages || messages.length === 0) return;

        // Process up to 50 recent customer messages
        const recentCustomerMsgs = messages
          .filter(msg => {
            const jid = msg.key?.remoteJid || '';
            return (jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid')) && jid !== 'status@broadcast';
          })
          .slice(-50);

        console.log(`Found ${recentCustomerMsgs.length} messages to import into Grahak`);

        for (const msg of recentCustomerMsgs) {
          const remoteJid = msg.key.remoteJid;
          const phoneJid = await resolvePhoneJid(msg);
          if (!phoneJid) continue;
          const whatsappNumber = extractPhone(phoneJid);
          if (!whatsappNumber) continue;

          const customerName = msg.pushName || null;
          const isFromMe = Boolean(msg.key?.fromMe);
          const body = extractMessageBody(msg);

          if (!body.trim()) continue;

          try {
            outbox.enqueue({
              whatsapp_number: whatsappNumber,
              customer_name: customerName,
              message_body: body,
              whatsapp_message_id: msg.key?.id,
              direction: isFromMe ? 'outbound' : 'inbound',
              business_id: BUSINESS_ID,
              timestamp: Number(msg.messageTimestamp) || null,
              is_history: true,
            });
          } catch (e) {
            console.error(`Failed to forward message from ${whatsappNumber}:`, e.message);
          }
        }
      } catch (syncErr) {
        console.error('Error in history sync handler:', syncErr);
      }
    });
  } catch (err) {
    console.error('Fatal error in initWhatsApp:', err);
    scheduleReconnect(5000);
  } finally {
    initializing = false;
  }
}

// ── REST API ENDPOINTS ───────────────────────────────────

// Status
app.get('/status', (req, res) => {
  res.json({
    connected: isConnected,
    phone: userPhone,
    name: userName,
    business_id: BUSINESS_ID,
    pending_messages: outbox.size,
  });
});

// QR code data
app.get('/qr', async (req, res) => {
  res.json({
    connected: isConnected,
    qr: currentQR,
    qr_image: currentQRImage,
    phone: userPhone,
    name: userName,
    business_id: BUSINESS_ID,
  });
});

async function resetBridgeInternal() {
  clearTimeout(reconnectTimer);
  console.log('🔄 Resetting WhatsApp session and clearing auth...');
  try {
    if (sock) {
      try { sock.ev.removeAllListeners(); } catch (e) {}
      try { sock.end(new Error('Reset requested')); } catch (e) {}
      sock = null;
    }
  } catch (err) {}

  await new Promise(r => setTimeout(r, 200));

  try {
    if (fs.existsSync(AUTH_DIR)) {
      const files = fs.readdirSync(AUTH_DIR);
      for (const f of files) {
        try { fs.unlinkSync(path.join(AUTH_DIR, f)); } catch (e) {}
      }
    }
  } catch (e) {}

  isConnected = false;
  currentQR = null;
  currentQRImage = null;
  userPhone = null;
  userName = null;
  consecutiveDisconnects = 0;

  try {
    axios.post(`${FASTAPI_URL}/api/v1/webhook/bridge/status`, {
      connected: false,
      phone: null,
    }, { timeout: 2000 }).catch(() => {});
  } catch {}

  scheduleReconnect(400);
}

// Reset pairing session explicitly to generate new QR immediately
app.post('/reset', (req, res) => {
  res.json({ success: true, message: 'Bridge reset initiated. New QR generating.' });
  resetBridgeInternal().catch(e => console.error('Reset error:', e));
});

// Outbound send message
app.post('/send', async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ error: 'phone and message are required' });
    }

    if (!sock || !isConnected) {
      return res.status(503).json({ error: 'WhatsApp is not connected. Please scan QR code first.' });
    }

    const cleanPhone = String(phone).replace(/\D/g, '');
    const jid = `${cleanPhone}@s.whatsapp.net`;

    const sent = await sock.sendMessage(jid, { text: message });
    console.log(`📤 Sent message to ${cleanPhone}: "${message.slice(0, 30)}..."`);

    res.json({ success: true, messageId: sent.key.id });
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: err.message });
  }
});

// Disconnect / logout
app.post('/disconnect', async (req, res) => {
  clearTimeout(reconnectTimer);
  console.log('🔌 Disconnect requested...');
  try {
    if (sock) {
      try {
        await Promise.race([
          sock.logout().catch(() => {}),
          new Promise(r => setTimeout(r, 1200))
        ]);
      } catch (e) {}
      try {
        sock.ev.removeAllListeners();
        sock.end(undefined);
      } catch (e) {}
      sock = null;
    }
  } catch (err) {}

  try {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  } catch (e) {}

  isConnected = false;
  currentQR = null;
  currentQRImage = null;
  userPhone = null;
  userName = null;
  consecutiveDisconnects = 0;

  try {
    await axios.post(`${FASTAPI_URL}/api/v1/webhook/bridge/status`, {
      connected: false,
      phone: null,
    });
  } catch {}

  scheduleReconnect(800);
  res.json({ success: true, message: 'Logged out. Ready for new QR scan.' });
});

if (!BUSINESS_ID || !BRIDGE_TOKEN) throw new Error('Set BUSINESS_ID and WHATSAPP_BRIDGE_TOKEN before starting the bridge.');
app.listen(PORT, process.env.HOST || '127.0.0.1', () => {
  console.log(`🚀 Grahak WhatsApp Companion Bridge running on http://localhost:${PORT}`);
  initWhatsApp();
});
