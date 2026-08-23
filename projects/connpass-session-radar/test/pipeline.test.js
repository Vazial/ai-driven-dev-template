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
    remainingSeatsKnown: true, remainingSeats: 10, isFull: false, attendeeCount: 10, catchPhrase: null
  });
  const { title, body } = formatDigest(createDigest(events));
  assert.equal(title, 'Connpass Session Radar — 8/22(土) 1件');
  assert.equal(body, [
    '**8/22(土)**',
    '',
    '[AWS study session](https://connpass.com/event/1/)',
    '　19:00 ・ Tokyo ・ Cloud group ・ 10人 ・ 残り10'
  ].join('\n'));
});

test('CSR-D-03: no matches yield an explicit zero digest', () => {
  const digest = createDigest(normalizeEvents([{ ...baseEvent, title: 'Python meetup' }], conditions, now));
  assert.deepEqual(digest, { status: 'zero', events: [] });
  assert.deepEqual(formatDigest(digest), {
    title: 'Connpass Session Radar — 今日は0件', body: '条件に合うイベントはありません。'
  });
});

test('connpass API v2 events from an online-only profile remain visibly online without a prefecture field', () => {
  const onlineProfile = { keywordsAny: ['aws'], prefectures: ['online'], windowDays: 7 };
  const event = { ...baseEvent, prefecture: undefined, place: 'YouTube Live', address: 'オンライン', matchedProfile: onlineProfile };
  const events = normalizeEvents([event], { profiles: [onlineProfile] }, now);
  assert.equal(events[0].isOnline, true);
  assert.match(formatDigest(createDigest(events)).body, /・ オンライン ・/);
  assert.doesNotMatch(formatDigest(createDigest(events)).body, /YouTube Live/);
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
  const text = formatDigest(createDigest(events)).body;
  assert.doesNotMatch(text.match(/AWS external registration[\s\S]*?(?=\n\[|$)/)[0], /残り|定員|満席/);
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
  assert.doesNotMatch(formatDigest(received[0]).body, /api key|leaked/i);
});

test('CSR-D-07: each run uses its supplied current conditions, without retained state', () => {
  const first = normalizeEvents([baseEvent], { profiles: [{ keywordsAny: ['aws'], windowDays: 7 }] }, now);
  const second = normalizeEvents([baseEvent], { profiles: [{ keywordsAny: ['python'], windowDays: 7 }] }, now);
  assert.equal(first.length, 1);
  assert.equal(second.length, 0);
});

test('a failed morning reports its cause to the injected sink and not to the recipient', async () => {
  const reported = [];
  let message;
  const digest = await runDailyDigest({
    conditions,
    eventSource: { fetch: async () => { throw new Error('connpass request failed with status 503'); } },
    notifier: { send: async (_digest, sent) => { message = sent; return { delivered: true }; } },
    onFailure: (error) => reported.push(error.message),
    now
  });
  assert.equal(digest.status, 'failed');
  assert.deepEqual(reported, ['connpass request failed with status 503']);
  assert.doesNotMatch(`${message.title}\n${message.body}`, /503/);
});

test('the attendee count travels as the popularity hint, and stays absent off connpass', () => {
  const events = normalizeEvents([
    { ...baseEvent, title: 'AWS popular', url: 'https://connpass.com/event/10/', limit: 200, accepted: 148 },
    { ...baseEvent, title: 'AWS elsewhere', url: 'https://connpass.com/event/11/', event_type: 'advertisement', accepted: 0 }
  ], conditions, now);
  assert.deepEqual(events.map(({ title, attendeeCount }) => ({ title, attendeeCount })), [
    { title: 'AWS popular', attendeeCount: 148 },
    { title: 'AWS elsewhere', attendeeCount: null }
  ]);
  const { body } = formatDigest(createDigest(events));
  assert.match(body, /AWS popular\]\(https:\/\/connpass.com\/event\/10\/\)\n　19:00 ・ Tokyo ・ Cloud group ・ 148人 ・ 残り52/);
  assert.doesNotMatch(body.split('AWS elsewhere')[1], /人 ・/);
});

test('adr/0005: the lead axis shows one day only, the publish axis ignores the start date', () => {
  const lead = { keywordsAny: ['aws'], startsInDays: 7, windowDays: 1 };
  const fresh = { keywordsAny: ['aws'], publishedWithinDays: 1 };
  const on = (iso, profile, url) => ({ ...baseEvent, url, started_at: iso, matchedProfile: profile });
  const leadEvents = normalizeEvents([
    on('2026-08-27T10:00:00+09:00', lead, 'https://connpass.com/event/20/'),
    on('2026-08-26T10:00:00+09:00', lead, 'https://connpass.com/event/21/'),
    on('2026-08-28T10:00:00+09:00', lead, 'https://connpass.com/event/22/')
  ], { profiles: [lead] }, now);
  assert.deepEqual(leadEvents.map((event) => event.url), ['https://connpass.com/event/20/']);

  const freshEvents = normalizeEvents([
    on('2026-11-30T10:00:00+09:00', fresh, 'https://connpass.com/event/23/'),
    on('2026-08-19T10:00:00+09:00', fresh, 'https://connpass.com/event/24/')
  ], { profiles: [fresh] }, now);
  assert.deepEqual(freshEvents.map((event) => event.url), ['https://connpass.com/event/23/'],
    'a conference months out is kept, one that already happened is not');
});

test("adr/0005: the organiser's own line is carried verbatim, and trimmed only when long", () => {
  const long = 'あ'.repeat(140);
  const events = normalizeEvents([
    { ...baseEvent, url: 'https://connpass.com/event/30/', catch: '  実務で使える  設計の勘所を  90分で ' },
    { ...baseEvent, url: 'https://connpass.com/event/31/', catch: long },
    { ...baseEvent, url: 'https://connpass.com/event/32/', catch: '' }
  ], conditions, now);
  const byUrl = Object.fromEntries(events.map((event) => [event.url, event.catchPhrase]));
  assert.equal(byUrl['https://connpass.com/event/30/'], '実務で使える 設計の勘所を 90分で');
  assert.equal([...byUrl['https://connpass.com/event/31/']].length, 101);
  assert.ok(byUrl['https://connpass.com/event/31/'].endsWith('…'));
  assert.equal(byUrl['https://connpass.com/event/32/'], null);
  assert.match(formatDigest(createDigest(events)).body, /\n　\*実務で使える 設計の勘所を 90分で\*/);
});

test('each event stands apart, so a long list does not read as one block of notes', () => {
  const day = (iso, url) => ({ ...baseEvent, url, started_at: iso });
  const { body } = formatDigest(createDigest(normalizeEvents([
    day('2026-08-22T10:00:00+09:00', 'https://connpass.com/event/40/'),
    day('2026-08-22T14:00:00+09:00', 'https://connpass.com/event/41/'),
    day('2026-08-23T10:00:00+09:00', 'https://connpass.com/event/42/')
  ], conditions, now)));
  const blocks = body.split('\n\n');
  assert.equal(blocks.length, 5, '日付見出し2つとイベント3つが、それぞれ空行で分かれる');
  assert.equal(blocks[0], '**8/22(土)**');
  assert.ok(blocks[1].startsWith('[') && blocks[2].startsWith('['));
  assert.equal(blocks[3], '**8/23(日)**');
});
