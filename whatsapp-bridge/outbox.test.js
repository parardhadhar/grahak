const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createOutbox } = require('./outbox');

test('failed delivery survives restart and is removed only after acknowledgement', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grahak-outbox-'));
  const file = path.join(dir, 'pending.json');
  const payload = { business_id:'qa', whatsapp_message_id:'msg-1', message_body:'test' };
  const first = createOutbox(file, async () => { throw new Error('Backend offline'); });
  first.enqueue(payload);
  await first.flush();
  assert.equal(first.size, 1);
  let deliveries = 0;
  const restored = createOutbox(file, async data => { assert.deepEqual(data, payload); deliveries++; });
  assert.equal(restored.size, 1);
  await restored.flush();
  assert.equal(deliveries, 1);
  assert.equal(restored.size, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), []);
  fs.unlinkSync(file);
  fs.rmdirSync(dir);
});
