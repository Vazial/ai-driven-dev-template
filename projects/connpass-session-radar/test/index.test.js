import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { main } from '../src/index.js';

function captureNotifier() {
  const sent = [];
  return { sent, async send(digest, message) { sent.push({ digest, message }); return { delivered: true, errorSummary: null }; } };
}

function withoutStderr(run) {
  const original = console.error;
  const lines = [];
  console.error = (line) => lines.push(line);
  return run().finally(() => { console.error = original; }).then(() => lines);
}

test('a missing connpass key still delivers one safe failure notification', async () => {
  const notifier = captureNotifier();
  const previous = process.env.CONNPASS_API_KEY;
  delete process.env.CONNPASS_API_KEY;
  try {
    const lines = await withoutStderr(() => main({ notifier }));
    assert.equal(notifier.sent.length, 1);
    assert.equal(notifier.sent[0].digest.status, 'failed');
    assert.match(notifier.sent[0].message.title, /取得に失敗しました/);
    assert.match(notifier.sent[0].message.body, /失敗しました/);
    assert.deepEqual(lines, ['daily digest failed: CONNPASS_API_KEY is required']);
  } finally {
    if (previous !== undefined) process.env.CONNPASS_API_KEY = previous;
  }
});

test('an unreadable conditions file still delivers one safe failure notification', async () => {
  const notifier = captureNotifier();
  const previous = process.env.CONNPASS_API_KEY;
  process.env.CONNPASS_API_KEY = 'test-key';
  try {
    const lines = await withoutStderr(() => main({
      notifier, conditionsPath: new URL('../interest-conditions.missing.yaml', import.meta.url)
    }));
    assert.equal(notifier.sent.length, 1);
    assert.equal(notifier.sent[0].digest.status, 'failed');
    assert.equal(lines.length, 1);
    assert.match(lines[0], /^daily digest failed: /);
  } finally {
    if (previous === undefined) delete process.env.CONNPASS_API_KEY;
    else process.env.CONNPASS_API_KEY = previous;
  }
});

test('the committed interest conditions parse under the strict field rules', async () => {
  const { loadInterestConditions } = await import('../src/config.js');
  const conditions = await loadInterestConditions(fileURLToPath(new URL('../interest-conditions.yaml', import.meta.url)));
  assert.ok(conditions.profiles.length > 0);
  assert.ok(conditions.profiles.every((profile) => Number.isInteger(profile.windowDays)));
});
