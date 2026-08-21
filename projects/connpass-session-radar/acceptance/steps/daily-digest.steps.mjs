import assert from 'node:assert/strict';
import {
  assertDigestEventFields,
  assertCommittedYamlConditions,
  assertOneRecipientNotification,
  assertSafeFailure,
  event,
  runMorningDelivery,
} from '../dsl/daily-digest.mjs';

export const steps = {
  async dailyDelivery(bridge, scenarioId) {
    return runMorningDelivery(bridge, scenarioId);
  },

  digestWasDelivered(capture) {
    assertOneRecipientNotification(capture);
    assert.equal(capture.notification.kind, 'digest');
    assert.ok(capture.notification.events.length > 0);
  },

  eventIsVisible(capture, fixtureEventRef) {
    assertDigestEventFields(event(capture, fixtureEventRef));
  },

  eventIsHidden(capture, fixtureEventRef) {
    assert.equal(event(capture, fixtureEventRef), undefined);
  },

  eventHasCapacity(capture, fixtureEventRef, kind) {
    const item = event(capture, fixtureEventRef);
    assertDigestEventFields(item);
    assert.equal(item.capacity.kind, kind);
  },

  remainingSeatEstimateIsNumeric(capture, fixtureEventRef) {
    const item = event(capture, fixtureEventRef);
    assertDigestEventFields(item);
    assert.equal(item.capacity.kind, 'remaining-estimate');
    assert.equal(Number.isInteger(item.capacity.remainingSeats), true);
  },

  committedConditionsAreYaml(input, revisionRef) {
    assertCommittedYamlConditions(input, revisionRef);
  },

  noMatchingEventsWasDelivered(capture) {
    assertOneRecipientNotification(capture);
    assert.equal(capture.notification.kind, 'no-matching-events');
    assert.deepEqual(capture.notification.events, []);
  },

  failureWasDelivered(capture, forbiddenCanary) {
    assertSafeFailure(capture, forbiddenCanary);
  },
};
