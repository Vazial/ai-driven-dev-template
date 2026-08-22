import { addTokyoDays, tokyoYmd } from './calendar.js';

const CONNPASS_EVENTS_URL = 'https://connpass.com/api/v2/events/';
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const DISCORD_EMBED_TOTAL_LIMIT = 6_000;
const DISCORD_EMBED_DESCRIPTION_LIMIT = 4_096;
const DISCORD_ATTACHMENT_NAME = 'connpass-session-radar.txt';

function datesFor(profile, now) {
  return Array.from({ length: profile.windowDays }, (_, index) => tokyoYmd(addTokyoDays(now, index)));
}

function queryFor(profile, now, start = 1) {
  const query = new URLSearchParams({ count: '100', order: '2', start: String(start) });
  for (const date of datesFor(profile, now)) query.append('ymd', date);
  for (const value of profile.keywords ?? []) query.append('keyword', value);
  for (const value of profile.keywordsAny ?? []) query.append('keyword_or', value);
  for (const value of profile.prefectures ?? []) query.append('prefecture', value);
  for (const value of profile.groupIds ?? []) query.append('group_id', String(value));
  return query;
}

export function createConnpassEventSource({ apiKey, fetchImpl = fetch, sleepImpl = sleep }) {
  if (!apiKey) throw new Error('CONNPASS_API_KEY is required');
  return {
    async fetch(conditions, now) {
      const all = [];
      let lastRequestAt = -Infinity;
      for (const profile of conditions.profiles) {
        let start = 1;
        while (true) {
          const wait = Math.max(0, 1_000 - (Date.now() - lastRequestAt));
          if (wait) await sleepImpl(wait);
          let response;
          for (let attempts = 0; attempts < 3; attempts += 1) {
            response = await fetchImpl(`${CONNPASS_EVENTS_URL}?${queryFor(profile, now, start)}`, {
              headers: { 'X-API-Key': apiKey }
            });
            lastRequestAt = Date.now();
            if (response.status !== 429) break;
            await sleepImpl(1_000);
          }
          if (!response.ok) throw new Error(`connpass request failed with status ${response.status}`);
          const page = await response.json();
          all.push(...page.events.map((event) => ({ ...event, matchedProfile: profile })));
          if (page.results_start + page.results_returned > page.results_available) break;
          start += page.results_returned;
          if (page.results_returned === 0) break;
        }
      }
      return all;
    }
  };
}

function discordDeliveryUrl(webhookUrl) {
  if (!webhookUrl) throw new Error('DISCORD_WEBHOOK_URL is required');
  try {
    const url = new URL(webhookUrl);
    url.searchParams.set('wait', 'true');
    return url.toString();
  } catch {
    throw new Error('DISCORD_WEBHOOK_URL must be a valid URL');
  }
}

function splitAtNewline(text, limit) {
  const chunks = [];
  let rest = text;
  while (rest.length > limit) {
    const candidate = rest.slice(0, limit);
    const newline = candidate.lastIndexOf('\n');
    const cut = newline >= 0 ? newline + 1 : limit;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function discordRequest(text) {
  const allowedMentions = { parse: [] };
  if (text.length <= DISCORD_EMBED_TOTAL_LIMIT) {
    return {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: splitAtNewline(text, DISCORD_EMBED_DESCRIPTION_LIMIT).map((description) => ({ description })),
        allowed_mentions: allowedMentions
      })
    };
  }

  const body = new FormData();
  body.append('payload_json', JSON.stringify({
    content: 'Connpass Session Radar: 一覧が長いため、完全な内容を添付ファイルに収めました。',
    allowed_mentions: allowedMentions
  }));
  body.append('files[0]', new Blob([text], { type: 'text/plain;charset=utf-8' }), DISCORD_ATTACHMENT_NAME);
  return { headers: undefined, body };
}

export function createDiscordNotifier({ webhookUrl, fetchImpl = fetch }) {
  const deliveryUrl = discordDeliveryUrl(webhookUrl);
  return {
    async send(_digest, text) {
      try {
        const request = discordRequest(text);
        const response = await fetchImpl(deliveryUrl, {
          method: 'POST',
          ...(request.headers ? { headers: request.headers } : {}),
          body: request.body
        });
        return response.ok ? { delivered: true, errorSummary: null } : { delivered: false, errorSummary: `Discord delivery failed (${response.status})` };
      } catch {
        return { delivered: false, errorSummary: 'Discord delivery request failed' };
      }
    }
  };
}
