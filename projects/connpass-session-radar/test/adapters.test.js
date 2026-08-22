import assert from 'node:assert/strict';
import test from 'node:test';
import { createConnpassEventSource, createDiscordNotifier } from '../src/adapters.js';

test('connpass adapter uses an API-key header, query filters, paging, and profile association', async () => {
  const calls = [];
  const source = createConnpassEventSource({
    apiKey: 'test-key', sleepImpl: async () => {},
    fetchImpl: async (url, options) => {
      calls.push({ url: new URL(url), options });
      return { ok: true, json: async () => ({ results_start: 1, results_returned: 1, results_available: 1, events: [{ title: 'AWS', url: 'https://connpass.com/e/1', event_type: 'participation' }] }) };
    }
  });
  const profile = { keywords: ['AWS'], keywordsAny: ['cloud'], prefectures: ['online'], groupIds: [9], windowDays: 2 };
  const events = await source.fetch({ profiles: [profile] }, new Date('2026-08-20T09:00:00+09:00'));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.headers['X-API-Key'], 'test-key');
  assert.deepEqual(calls[0].url.searchParams.getAll('ymd'), ['20260820', '20260821']);
  assert.equal(calls[0].url.searchParams.get('keyword'), 'AWS');
  assert.equal(calls[0].url.searchParams.get('keyword_or'), 'cloud');
  assert.equal(calls[0].url.searchParams.get('prefecture'), 'online');
  assert.equal(calls[0].url.searchParams.get('group_id'), '9');
  assert.equal(events[0].matchedProfile, profile);
});

test('connpass adapter retries a throttled request after one second', async () => {
  let calls = 0;
  const waits = [];
  const source = createConnpassEventSource({
    apiKey: 'test-key', sleepImpl: async (milliseconds) => waits.push(milliseconds),
    fetchImpl: async () => {
      calls += 1;
      return calls === 1
        ? { ok: false, status: 429 }
        : { ok: true, status: 200, json: async () => ({ results_start: 1, results_returned: 0, results_available: 0, events: [] }) };
    }
  });
  assert.deepEqual(await source.fetch({ profiles: [{ windowDays: 1 }] }, new Date('2026-08-20T09:00:00+09:00')), []);
  assert.equal(calls, 2);
  assert.deepEqual(waits, [1_000]);
});

test('connpass adapter emits Tokyo calendar dates independent of host timezone', async () => {
  let requestUrl;
  const source = createConnpassEventSource({
    apiKey: 'test-key', sleepImpl: async () => {},
    fetchImpl: async (url) => {
      requestUrl = new URL(url);
      return { ok: true, json: async () => ({ results_start: 1, results_returned: 0, results_available: 0, events: [] }) };
    }
  });
  await source.fetch({ profiles: [{ windowDays: 2 }] }, new Date('2026-08-20T09:00:00+09:00'));
  assert.deepEqual(requestUrl.searchParams.getAll('ymd'), ['20260820', '20260821']);
});

test('Discord adapter sends a confirmed embed with mentions disabled', async () => {
  assert.throws(() => createDiscordNotifier({ webhookUrl: '' }), /DISCORD_WEBHOOK_URL is required/);
  assert.throws(() => createDiscordNotifier({ webhookUrl: 'not-a-url' }), /must be a valid URL/);

  let call;
  const webhookUrl = 'https://discord.com/api/webhooks/123/test-secret?thread_id=456';
  const notifier = createDiscordNotifier({ webhookUrl, fetchImpl: async (url, options) => {
    call = { url, options };
    return { ok: true, status: 200 };
  } });
  assert.deepEqual(await notifier.send({}, { title: 'Connpass Session Radar — 1件', body: 'digest body' }), { delivered: true, errorSummary: null });
  const deliveryUrl = new URL(call.url);
  assert.equal(deliveryUrl.searchParams.get('thread_id'), '456');
  assert.equal(deliveryUrl.searchParams.get('wait'), 'true');
  assert.deepEqual(call.options.headers, { 'Content-Type': 'application/json' });
  assert.deepEqual(JSON.parse(call.options.body), {
    embeds: [{ title: 'Connpass Session Radar — 1件', description: 'digest body' }],
    allowed_mentions: { parse: [] }
  });

  // The title counts against the same 6,000 character budget as the descriptions.
  const boundaryText = `${'a'.repeat(4_000)}\n${'b'.repeat(1_998)}`;
  await notifier.send({}, { title: 'T', body: boundaryText });
  const boundaryPayload = JSON.parse(call.options.body);
  assert.deepEqual(boundaryPayload.embeds.map(({ description }) => description).join(''), boundaryText);
  assert.ok(boundaryPayload.embeds.every(({ description }) => description.length <= 4_096));
  assert.equal(boundaryPayload.embeds[0].title, 'T');
  assert.equal(boundaryPayload.embeds.reduce((sum, { description }) => sum + description.length, 1), 6_000);

  const newlineAfterLimit = `${'c'.repeat(4_096)}\nrest`;
  await notifier.send({}, { title: 'T', body: newlineAfterLimit });
  const newlineAfterLimitPayload = JSON.parse(call.options.body);
  assert.deepEqual(newlineAfterLimitPayload.embeds.map(({ description }) => description).join(''), newlineAfterLimit);
  assert.ok(newlineAfterLimitPayload.embeds.every(({ description }) => description.length <= 4_096));
});

test('Discord adapter keeps an over-limit digest complete in one message attachment', async () => {
  let call;
  const webhookUrl = 'https://discord.com/api/webhooks/123/test-secret';
  const notifier = createDiscordNotifier({ webhookUrl, fetchImpl: async (url, options) => {
    call = { url, options };
    return { ok: true, status: 200 };
  } });
  const longText = `Connpass Session Radar\n${'イベント情報\n'.repeat(1_001)}`;
  assert.ok(longText.length > 6_000);
  assert.deepEqual(await notifier.send({}, { title: 'T', body: longText }), { delivered: true, errorSummary: null });
  assert.equal(call.options.headers, undefined);
  assert.ok(call.options.body instanceof FormData);
  const payload = JSON.parse(call.options.body.get('payload_json'));
  assert.deepEqual(payload.allowed_mentions, { parse: [] });
  assert.match(payload.content, /添付ファイル/);
  const attachment = call.options.body.get('files[0]');
  assert.equal(attachment.name, 'connpass-session-radar.txt');
  assert.equal(attachment.type, 'text/plain;charset=utf-8');
  assert.equal(await attachment.text(), `T\n\n${longText}`);

  const failed = createDiscordNotifier({ webhookUrl, fetchImpl: async () => ({ ok: false, status: 403 }) });
  const failure = await failed.send({}, { title: 'T', body: 'body' });
  assert.deepEqual(failure, { delivered: false, errorSummary: 'Discord delivery failed (403)' });
  assert.equal(failure.errorSummary.includes('test-secret'), false);

  const unavailable = createDiscordNotifier({ webhookUrl, fetchImpl: async () => { throw new Error('network unavailable'); } });
  assert.deepEqual(await unavailable.send({}, { title: 'T', body: 'body' }), { delivered: false, errorSummary: 'Discord delivery request failed' });
});

test('Discord embed splitting never cuts an astral character in half', async () => {
  let call;
  const notifier = createDiscordNotifier({
    webhookUrl: 'https://discord.com/api/webhooks/123/test-secret',
    fetchImpl: async (url, options) => { call = { url, options }; return { ok: true, status: 200 }; }
  });
  const text = `${'a'.repeat(4_095)}${'\u{1F600}'.repeat(500)}`;
  await notifier.send({}, { title: 'T', body: text });
  const { embeds } = JSON.parse(call.options.body);
  assert.equal(embeds.map(({ description }) => description).join(''), text);
  for (const { description } of embeds) {
    assert.ok(description.length <= 4_096);
    assert.doesNotMatch(description, /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
  }
});
