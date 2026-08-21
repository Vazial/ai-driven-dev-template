import { fileURLToPath } from 'node:url';
import { createConnpassEventSource, createLineNotifier } from './adapters.js';
import { loadInterestConditions } from './config.js';
import { runDailyDigest } from './pipeline.js';

export async function main({ conditionsPath = new URL('../interest-conditions.yaml', import.meta.url) } = {}) {
  const conditions = await loadInterestConditions(fileURLToPath(conditionsPath));
  return runDailyDigest({
    conditions,
    eventSource: createConnpassEventSource({ apiKey: process.env.CONNPASS_API_KEY }),
    notifier: createLineNotifier({ channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN })
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
