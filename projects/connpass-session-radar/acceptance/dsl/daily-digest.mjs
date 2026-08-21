import assert from 'node:assert/strict';

// Exact value from fixtures.fetch-failure.fetchFailureCanaryExpectation in the approved v0.3 seam.
export const fetchFailureCanary = 'CSR_D_04_SYNTHETIC_PRIVATE_CANARY_NOT_A_REAL_SECRET';

const conditionRevisions = {
  'standard-conditions': {
    revisionRef: 'standard-conditions',
    sourceFormat: 'yaml',
    committed: true,
    conditions: { profiles: [{ keywords: ['standard-topic'], windowDays: 7 }] },
  },
  'revised-conditions': {
    revisionRef: 'revised-conditions',
    sourceFormat: 'yaml',
    committed: true,
    conditions: { profiles: [{ keywords: ['revised-topic'], windowDays: 7 }] },
  },
};

const fixtureInputs = {
  'CSR-D-01': ['normal-with-match', 'standard-conditions'],
  'CSR-D-02': ['normal-with-match', 'standard-conditions'],
  'CSR-D-03': ['no-match', 'standard-conditions'],
  'CSR-D-04': ['fetch-failure', 'standard-conditions'],
  'CSR-D-05': ['advertisement-mixed', 'standard-conditions'],
  'CSR-D-06': ['cancelled-mixed', 'standard-conditions'],
  'CSR-D-07': ['conditions-changed', 'revised-conditions'],
  'CSR-D-08': ['unlimited-capacity', 'standard-conditions'],
  'CSR-D-09': ['full-or-waitlisted', 'standard-conditions'],
  'CSR-D-10': ['out-of-window-mixed', 'standard-conditions'],
};

export function acceptanceInput(scenarioId) {
  const [fixtureRef, conditionRef] = fixtureInputs[scenarioId] ?? [];
  assert.ok(fixtureRef, `No approved fixture is mapped for ${scenarioId}`);
  return { fixtureRef, committedInterestConditions: conditionRevisions[conditionRef] };
}

export async function runMorningDelivery(bridge, scenarioId) {
  assert.equal(typeof bridge?.runAcceptance, 'function',
    'Acceptance bridge must expose runAcceptance(input)');
  return bridge.runAcceptance(acceptanceInput(scenarioId));
}

export function assertOneRecipientNotification(capture) {
  assert.equal(capture?.attempted, true, 'The notifier must be attempted');
  assert.equal(capture?.notificationCount, 1, 'Exactly one notification must be attempted');
  assert.ok(capture.notification, 'Recipient-visible notification must be captured');
}

export function assertCommittedYamlConditions(input, expectedRevisionRef) {
  const conditions = input?.committedInterestConditions;
  assert.equal(conditions?.sourceFormat, 'yaml');
  assert.equal(conditions?.committed, true);
  assert.equal(conditions?.revisionRef, expectedRevisionRef);
  assert.ok(Array.isArray(conditions?.conditions?.profiles));
  assert.ok(conditions.conditions.profiles.length > 0);
}

export function event(capture, fixtureEventRef) {
  return capture.notification.events.find((item) => item.fixtureEventRef === fixtureEventRef);
}

export function assertDigestEventFields(item) {
  assert.ok(item, 'Expected recipient-visible event was not captured');
  assert.equal(typeof item.title, 'string');
  assert.ok(item.startedAt === null || typeof item.startedAt === 'string');
  assert.ok(['place', 'online'].includes(item.location?.kind));
  assert.ok(item.groupTitle === null || typeof item.groupTitle === 'string');
  assert.equal(typeof item.link, 'string');
  assert.ok(item.capacity && typeof item.capacity.kind === 'string');
}

export function assertSafeFailure(capture, forbiddenCanary) {
  assertOneRecipientNotification(capture);
  assert.equal(capture.notification.kind, 'failure');
  assert.deepEqual(capture.notification.events, []);
  assert.equal(typeof capture.notification.safeFailureSummary, 'string');
  assert.equal(capture.notification.safeFailureSummary.includes(forbiddenCanary), false);
}
