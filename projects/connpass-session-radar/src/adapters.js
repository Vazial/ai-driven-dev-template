const CONNPASS_EVENTS_URL = 'https://connpass.com/api/v2/events/';
const LINE_BROADCAST_URL = 'https://api.line.me/v2/bot/message/broadcast';

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function datesFor(profile, now) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Array.from({ length: profile.windowDays }, (_, index) => {
    const date = new Date(start.getTime() + index * 86_400_000);
    return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  });
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

export function createLineNotifier({ channelAccessToken, fetchImpl = fetch }) {
  if (!channelAccessToken) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is required');
  return {
    async send(_digest, text) {
      try {
        const response = await fetchImpl(LINE_BROADCAST_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${channelAccessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ messages: [{ type: 'text', text }] })
        });
        return response.ok ? { delivered: true, errorSummary: null } : { delivered: false, errorSummary: `LINE delivery failed (${response.status})` };
      } catch {
        return { delivered: false, errorSummary: 'LINE delivery request failed' };
      }
    }
  };
}
