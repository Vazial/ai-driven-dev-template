// Acceptance-only seams described by contracts/daily-digest-test-support.yaml.
// These adapters never read secrets or call an external provider.

const DAY_MS = 24 * 60 * 60 * 1000;
export const FETCH_FAILURE_CANARY = 'CSR_D_04_SYNTHETIC_PRIVATE_CANARY_NOT_A_REAL_SECRET';
const fixtureEvent = (fixtureEventRef, now, overrides = {}) => ({
  fixtureEventRef, title: `${fixtureEventRef} study session`, url: `https://example.test/events/${fixtureEventRef}`,
  started_at: new Date(now.getTime() + 2 * DAY_MS).toISOString(), place: 'Tokyo', address: 'Tokyo',
  prefecture: 'tokyo', event_type: 'participation', open_status: 'open', limit: 20, accepted: 10, waiting: 0,
  catch: 'standard-topic revised-topic', group: { id: 1, title: 'Example group' }, ...overrides
});

export function createFixtureEventSource({ fixtureRef }) {
  return { async fetch(conditions, now = new Date()) {
    if (fixtureRef === 'fetch-failure') throw new Error(`fixture fetch failure: ${FETCH_FAILURE_CANARY}`);
    const matching = (ref, overrides = {}) => fixtureEvent(ref, now, overrides);
    const nonmatching = matching('nonmatching-event', { title: 'unrelated event', catch: 'unrelated' });
    switch (fixtureRef) {
      case 'no-match': return [nonmatching];
      case 'normal-with-match': return [matching('matching-event'), nonmatching];
      case 'advertisement-mixed': return [matching('participation-event'), matching('advertisement-event', { event_type: 'advertisement', limit: null })];
      case 'cancelled-mixed': return [matching('active-event'), matching('cancelled-event', { open_status: 'cancelled' })];
      case 'conditions-changed': return [matching('matches-revised-condition', { catch: 'revised-topic' }), matching('matches-previous-condition-only', { catch: 'standard-topic' })];
      case 'unlimited-capacity': return [matching('unlimited-event', { limit: null })];
      case 'full-or-waitlisted': return [matching('no-seat-event', { accepted: 20 }), matching('waitlisted-event', { accepted: 20, waiting: 1 })];
      case 'out-of-window-mixed': return [matching('within-window-event'), matching('after-window-event', { started_at: new Date(now.getTime() + 10 * DAY_MS).toISOString() })];
      default: throw new Error(`unknown fixtureRef: ${fixtureRef}`);
    }
  } };
}

function visibleEvent(event) {
  const location = event.isOnline ? { kind: 'online', place: null } : { kind: 'place', place: [event.place, event.address].filter(Boolean).join(' / ') || null };
  const capacity = event.eventType === 'advertisement' ? { kind: 'omitted-for-advertisement', remainingSeats: null }
    : !event.remainingSeatsKnown ? { kind: 'unlimited', remainingSeats: null }
      : event.isFull ? { kind: 'full', remainingSeats: null } : { kind: 'remaining-estimate', remainingSeats: event.remainingSeats };
  return { fixtureEventRef: event.fixtureEventRef ?? event.url, title: event.title, startedAt: event.startedAt, location, groupTitle: event.groupTitle, link: event.url, capacity };
}

export function createRecipientNotificationCapture() {
  let capture = { attempted: false, notificationCount: 0, notification: null };
  return {
    async send(digest) {
      const kind = digest.status === 'failed' ? 'failure' : digest.status === 'zero' ? 'no-matching-events' : 'digest';
      capture = { attempted: true, notificationCount: 1, notification: { kind, events: digest.events.map(visibleEvent), safeFailureSummary: kind === 'failure' ? digest.failureReason : null } };
      return { delivered: true, errorSummary: null };
    },
    getCapture() { return structuredClone(capture); }
  };
}
