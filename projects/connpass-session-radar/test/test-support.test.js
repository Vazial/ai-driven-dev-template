import assert from 'node:assert/strict';
import test from 'node:test';
import { createFixtureEventSource, createRecipientNotificationCapture } from '../src/acceptance-support.js';
import { runAcceptance } from '../src/acceptance-bridge.js';
import { runDailyDigest } from '../src/pipeline.js';

const now = new Date('2026-08-20T09:00:00+09:00');
const standard = { profiles: [{ keywords: ['standard-topic'], windowDays: 7 }] };
const revised = { profiles: [{ keywords: ['revised-topic'], windowDays: 7 }] };

async function run(fixtureRef, conditions = standard) {
  const notifier = createRecipientNotificationCapture();
  await runDailyDigest({ conditions, eventSource: createFixtureEventSource({ fixtureRef }), notifier, now });
  return notifier.getCapture();
}

test('fixture source supports the approved modes and stable event references', async () => {
  const normal = await run('normal-with-match');
  assert.equal(normal.notification.kind, 'digest');
  assert.deepEqual(normal.notification.events.map((event) => event.fixtureEventRef), ['matching-event']);
  const revisedCapture = await run('conditions-changed', revised);
  assert.deepEqual(revisedCapture.notification.events.map((event) => event.fixtureEventRef), ['matches-revised-condition']);
});

test('capture exposes recipient-visible capacity and outcome semantics', async () => {
  const mixed = await run('advertisement-mixed');
  assert.deepEqual(mixed.notification.events.map((event) => event.capacity.kind), ['remaining-estimate', 'omitted-for-advertisement']);
  assert.equal((await run('no-match')).notification.kind, 'no-matching-events');
  assert.equal((await run('fetch-failure')).notification.kind, 'failure');
  assert.equal((await run('fetch-failure')).notification.safeFailureSummary.includes('fixture'), false);
});

test('acceptance bridge runs the approved input shape without provider I/O', async () => {
  const capture = await runAcceptance({
    fixtureRef: 'normal-with-match',
    committedInterestConditions: {
      revisionRef: 'standard-conditions', sourceFormat: 'yaml', committed: true,
      conditions: { profiles: [{ keywords: ['standard-topic'], windowDays: 7 }] }
    }
  });
  assert.equal(capture.attempted, true);
  assert.equal(capture.notification.events[0].fixtureEventRef, 'matching-event');
});
