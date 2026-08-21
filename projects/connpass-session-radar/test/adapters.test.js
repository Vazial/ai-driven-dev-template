import assert from 'node:assert/strict';
import test from 'node:test';
import { createConnpassEventSource, createSlackNotifier } from '../src/adapters.js';

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

test('Slack adapter posts one webhook message and keeps provider errors safe', async () => {
  assert.throws(() => createSlackNotifier({ webhookUrl: '' }), /SLACK_WEBHOOK_URL is required/);

  let call;
  const webhookUrl = 'https://hooks.slack.com/services/T000/B000/test-secret';
  const notifier = createSlackNotifier({ webhookUrl, fetchImpl: async (url, options) => {
    call = { url, options };
    return { ok: true, status: 200 };
  } });
  assert.deepEqual(await notifier.send({}, 'digest body'), { delivered: true, errorSummary: null });
  assert.equal(call.url, webhookUrl);
  assert.equal(call.options.method, 'POST');
  assert.deepEqual(call.options.headers, { 'Content-Type': 'application/json' });
  assert.deepEqual(JSON.parse(call.options.body), { text: 'digest body' });

  const failed = createSlackNotifier({ webhookUrl, fetchImpl: async () => ({ ok: false, status: 403 }) });
  assert.deepEqual(await failed.send({}, 'body'), { delivered: false, errorSummary: 'Slack delivery failed (403)' });
  assert.equal((await failed.send({}, 'body')).errorSummary.includes('test-secret'), false);

  const unavailable = createSlackNotifier({ webhookUrl, fetchImpl: async () => { throw new Error('network unavailable'); } });
  assert.deepEqual(await unavailable.send({}, 'body'), { delivered: false, errorSummary: 'Slack delivery request failed' });
});
