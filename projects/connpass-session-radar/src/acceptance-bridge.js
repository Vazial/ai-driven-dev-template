import { createFixtureEventSource, createRecipientNotificationCapture } from './acceptance-support.js';
import { runDailyDigest } from './pipeline.js';

// Developer-owned bridge for the tester's acceptance runner. It accepts only
// the approved AcceptanceRunInput logical shape and returns its capture seam.
export async function runAcceptance(input) {
  const { fixtureRef, committedInterestConditions } = input ?? {};
  if (!fixtureRef || committedInterestConditions?.committed !== true) {
    throw new Error('AcceptanceRunInput requires a fixtureRef and committed conditions');
  }
  const notifier = createRecipientNotificationCapture();
  await runDailyDigest({
    conditions: committedInterestConditions.conditions,
    eventSource: createFixtureEventSource({ fixtureRef }),
    notifier
  });
  return notifier.getCapture();
}

export default { runAcceptance };
