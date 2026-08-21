import assert from 'node:assert/strict';
import test from 'node:test';
import { createDigest, formatDigest, normalizeEvents, runDailyDigest } from '../src/pipeline.js';

const now = new Date('2026-08-20T09:00:00+09:00');
const conditions = { profiles: [{ keywordsAny: ['aws'], windowDays: 7 }] };
const baseEvent = {
  title: 'AWS study session', url: 'https://connpass.com/event/1/', started_at: '2026-08-22T19:00:00+09:00',
  place: 'Tokyo', address: 'Tokyo', prefecture: 'tokyo', event_type: 'participation', open_status: 'open',
  limit: 20, accepted: 10, waiting: 0, group: { id: 1, title: 'Cloud group' }
};

test('CSR-D-01 and CSR-D-02: only matching events become a complete daily digest', () => {
  const events = normalizeEvents([baseEvent, { ...baseEvent, title: 'Kubernetes study', url: 'https://connpass.com/event/2/' }], conditions, now);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], {
    title: 'AWS study session', url: 'https://connpass.com/event/1/', startedAt: '2026-08-22T19:00:00+09:00',
    place: 'Tokyo', address: 'Tokyo', isOnline: false, groupTitle: 'Cloud group', eventType: 'participation',
    remainingSeatsKnown: true, remainingSeats: 10, isFull: false
  });
  assert.match(formatDigest(createDigest(events)), /AWS study session[\s\S]*日時:[\s\S]*場所:[\s\S]*主催:[\s\S]*残席目安:[\s\S]*https:\/\/connpass/);
});

test('CSR-D-03: no matches yield an explicit zero digest', () => {
  const digest = createDigest(normalizeEvents([{ ...baseEvent, title: 'Python meetup' }], conditions, now));
  assert.deepEqual(digest, { status: 'zero', events: [] });
  assert.match(formatDigest(digest), /該当するイベントはありません/);
});

test('CSR-D-05, CSR-D-06, CSR-D-08 and CSR-D-09 preserve their capacity rules', () => {
  const events = normalizeEvents([
    { ...baseEvent, title: 'AWS external registration', url: 'https://connpass.com/event/3/', event_type: 'advertisement' },
    { ...baseEvent, title: 'AWS cancelled', url: 'https://connpass.com/event/4/', open_status: 'cancelled' },
    { ...baseEvent, title: 'AWS unlimited', url: 'https://connpass.com/event/5/', limit: null },
    { ...baseEvent, title: 'AWS waitlist', url: 'https://connpass.com/event/6/', accepted: 20, waiting: 1 }
  ], conditions, now);
  assert.deepEqual(events.map(({ title, remainingSeatsKnown, remainingSeats, isFull }) => ({ title, remainingSeatsKnown, remainingSeats, isFull })), [
    { title: 'AWS external registration', remainingSeatsKnown: false, remainingSeats: null, isFull: false },
    { title: 'AWS unlimited', remainingSeatsKnown: false, remainingSeats: null, isFull: false },
    { title: 'AWS waitlist', remainingSeatsKnown: true, remainingSeats: 0, isFull: true }
  ]);
  const text = formatDigest(createDigest(events));
  assert.doesNotMatch(text.match(/AWS external registration[\s\S]*?(?=\n\n|$)/)[0], /残席|定員/);
  assert.match(text, /AWS unlimited[\s\S]*定員なし/);
  assert.match(text, /AWS waitlist[\s\S]*満席/);
});

test('CSR-D-10: events beyond a profile window are excluded', () => {
  const events = normalizeEvents([
    baseEvent,
    { ...baseEvent, title: 'AWS later', url: 'https://connpass.com/event/7/', started_at: '2026-08-27T00:00:00+09:00' }
  ], conditions, now);
  assert.deepEqual(events.map((event) => event.title), ['AWS study session']);
});

test('CSR-D-10: window boundaries use the Tokyo calendar on UTC hosts', () => {
  const atWindowEnd = { ...baseEvent, title: 'AWS at Tokyo day eight', url: 'https://connpass.com/event/8/', started_at: '2026-08-27T00:00:00+09:00' };
  const atWindowStart = { ...baseEvent, title: 'AWS at Tokyo day seven', url: 'https://connpass.com/event/9/', started_at: '2026-08-26T23:59:59+09:00' };
  assert.deepEqual(normalizeEvents([atWindowEnd, atWindowStart], conditions, now).map((event) => event.title), ['AWS at Tokyo day seven']);
});

test('CSR-D-04: a fetch failure still makes one safe failed digest delivery attempt', async () => {
  const received = [];
  const digest = await runDailyDigest({
    conditions,
    eventSource: { fetch: async () => { throw new Error('api key leaked: no'); } },
    notifier: { send: async (value) => { received.push(value); return { delivered: true }; } },
    now
  });
  assert.deepEqual(digest, { status: 'failed', events: [], failureReason: 'イベントの取得または一覧作りに失敗しました。' });
  assert.equal(received.length, 1);
  assert.doesNotMatch(formatDigest(received[0]), /api key|leaked/i);
});

test('CSR-D-07: each run uses its supplied current conditions, without retained state', () => {
  const first = normalizeEvents([baseEvent], { profiles: [{ keywordsAny: ['aws'], windowDays: 7 }] }, now);
  const second = normalizeEvents([baseEvent], { profiles: [{ keywordsAny: ['python'], windowDays: 7 }] }, now);
  assert.equal(first.length, 1);
  assert.equal(second.length, 0);
});
