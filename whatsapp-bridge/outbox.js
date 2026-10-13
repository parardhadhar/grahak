const fs = require('fs');
const path = require('path');

// Keep received messages on disk until the CRM confirms receipt.
function createOutbox(file, deliver) {
  const pending = new Map(fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : []);
  let flushing = false;
  function persist() {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(`${file}.tmp`, JSON.stringify([...pending]));
    fs.renameSync(`${file}.tmp`, file);
  }
  async function flush() {
    if (flushing) return;
    flushing = true;
    try {
      for (const [key, payload] of pending) {
        try { await deliver(payload); }
        catch { break; }
        pending.delete(key);
        persist();
      }
    } finally { flushing = false; }
  }
  function enqueue(payload) {
    if (!payload.whatsapp_message_id) throw new Error('Message identifier required');
    const key = `${payload.business_id}:${payload.whatsapp_message_id}`;
    pending.set(key, payload);
    persist();
    void flush();
  }
  return { enqueue, flush, get size() { return pending.size; } };
}
module.exports = { createOutbox };
