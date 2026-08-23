import { fileURLToPath } from 'node:url';
import { createConnpassEventSource, createDiscordNotifier } from './adapters.js';
import { loadInterestConditions } from './config.js';
import { deliver, failedDigest, runDailyDigest } from './pipeline.js';

const reportFailure = (error) => console.error(`daily digest failed: ${error.message}`);

export async function main({
  conditionsPath = new URL('../interest-conditions.yaml', import.meta.url),
  notifier = createDiscordNotifier({ webhookUrl: process.env.DISCORD_WEBHOOK_URL })
} = {}) {
  // The notifier is built before anything else can fail: a missing key or an
  // unreadable conditions file is exactly the "could not fetch or could not
  // build the list" morning that still owes the recipient one message
  // (product-brief §6, CSR-D-04).
  let conditions;
  let eventSource;
  try {
    conditions = await loadInterestConditions(fileURLToPath(conditionsPath));
    eventSource = createConnpassEventSource({ apiKey: process.env.CONNPASS_API_KEY });
  } catch (error) {
    reportFailure(error);
    return deliver(notifier, failedDigest());
  }
  return runDailyDigest({ conditions, eventSource, notifier, onFailure: reportFailure });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
