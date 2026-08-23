import { tokyoDayLabel, tokyoMidnight, tokyoTimeLabel } from './calendar.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// A publish-date profile puts no ceiling on the start date — that is the point,
// it catches a conference announced for three months out — but an event that has
// already happened is never worth reading about, so today's midnight is a floor
// for both kinds of profile.
export function isInWindow(startedAt, profile, now = new Date()) {
  if (startedAt == null) return true;
  const start = new Date(startedAt).getTime();
  const dayStart = tokyoMidnight(now).getTime();
  if (start < dayStart) return false;
  if (profile.publishedWithinDays) return true;
  const from = dayStart + (profile.startsInDays ?? 0) * DAY_MS;
  return start >= from && start < from + profile.windowDays * DAY_MS;
}

function includesAll(haystack, needles = []) {
  return needles.every((value) => haystack.includes(String(value).toLowerCase()));
}

function includesAny(haystack, needles = []) {
  return needles.length === 0 || needles.some((value) => haystack.includes(String(value).toLowerCase()));
}

export function matchesProfile(event, profile) {
  const searchable = [event.title, event.catch, event.description, event.address].filter(Boolean).join(' ').toLowerCase();
  return includesAll(searchable, profile.keywords)
    && includesAny(searchable, profile.keywordsAny)
    && (!profile.prefectures?.length || profile.prefectures.includes(event.prefecture))
    && (!profile.groupIds?.length || profile.groupIds.includes(event.group?.id));
}

const CATCH_PHRASE_LIMIT = 100;

// The organiser's own one-liner, which is what tells a reader whether an event
// titled "AIコンサル育成講座 第2回" is worth opening. Kept verbatim, only cut when
// long enough to crowd out the rest of the list.
function trimCatchPhrase(value) {
  const text = value?.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return [...text].length <= CATCH_PHRASE_LIMIT ? text : `${[...text].slice(0, CATCH_PHRASE_LIMIT).join('')}…`;
}

export function normalizeEvents(events, conditions, now = new Date()) {
  const byUrl = new Map();
  for (const event of events) {
    if (event.open_status === 'cancelled') continue;
    const profile = event.matchedProfile ?? conditions.profiles.find((item) => matchesProfile(event, item));
    if (!profile || !isInWindow(event.started_at, profile, now)) continue;

    const remainingSeatsKnown = event.event_type === 'participation' && event.limit != null;
    const remainingSeats = remainingSeatsKnown ? Math.max(0, event.limit - event.accepted) : null;
    const isOnlineOnlyProfile = profile.prefectures?.length === 1 && profile.prefectures[0] === 'online';
    const normalized = {
      title: event.title,
      url: event.url,
      startedAt: event.started_at ?? null,
      place: event.place ?? null,
      address: event.address ?? null,
      isOnline: event.prefecture === 'online' || isOnlineOnlyProfile,
      groupTitle: event.group?.title ?? null,
      eventType: event.event_type,
      remainingSeatsKnown,
      remainingSeats,
      isFull: remainingSeatsKnown && (remainingSeats === 0 || event.waiting > 0),
      attendeeCount: event.event_type === 'participation' ? event.accepted ?? null : null,
      catchPhrase: trimCatchPhrase(event.catch)
    };
    if (event.fixtureEventRef !== undefined) normalized.fixtureEventRef = event.fixtureEventRef;
    byUrl.set(normalized.url, normalized);
  }
  return [...byUrl.values()].sort((left, right) => (left.startedAt ?? '').localeCompare(right.startedAt ?? ''));
}

export function createDigest(events) {
  return { status: events.length === 0 ? 'zero' : 'ok', events };
}

export function failedDigest() {
  return { status: 'failed', events: [], failureReason: 'イベントの取得または一覧作りに失敗しました。' };
}

const HEADING = 'Connpass Session Radar';

function placeOf(event) {
  if (event.isOnline) return 'オンライン';
  return [event.place, event.address].filter(Boolean)[0] ?? '開催場所未定';
}

function capacityOf(event) {
  if (event.eventType === 'advertisement') return null;
  if (!event.remainingSeatsKnown) return '定員なし';
  return event.isFull ? '**満席**' : `残り${event.remainingSeats}`;
}

function spanOf(events) {
  const days = events.filter((event) => event.startedAt).map((event) => tokyoDayLabel(event.startedAt));
  if (days.length === 0) return null;
  const [first, last] = [days[0], days[days.length - 1]];
  return first === last ? first : `${first}〜${last}`;
}

// Markdown, because the digest is read inside a Discord embed: the title
// carries the link so the event line stays one line, and the day heading
// gives a week's worth of events something to hang on.
export function formatDigest(digest) {
  if (digest.status === 'failed') return { title: `${HEADING} — 取得に失敗しました`, body: digest.failureReason };
  if (digest.status === 'zero') return { title: `${HEADING} — 今日は0件`, body: '条件に合うイベントはありません。' };

  // Every event is three lines now, so without a blank line between them the
  // list reads as one block of notes. Discord embeds render bold, italic and
  // masked links but not headings, so whitespace is what separates things here.
  const lines = [];
  let heading;
  for (const event of digest.events) {
    const day = event.startedAt ? tokyoDayLabel(event.startedAt) : '日時未定';
    if (day !== heading) {
      if (heading) lines.push('');
      lines.push(`**${day}**`, '');
      heading = day;
    } else {
      lines.push('');
    }
    const meta = [
      event.startedAt ? tokyoTimeLabel(event.startedAt) : '時刻未定',
      placeOf(event),
      event.groupTitle,
      event.attendeeCount == null ? null : `${event.attendeeCount}人`,
      capacityOf(event)
    ].filter(Boolean).join(' ・ ');
    lines.push(`[${event.title}](${event.url})`);
    lines.push(`　${meta}`);
    if (event.catchPhrase) lines.push(`　*${event.catchPhrase}*`);
  }
  const span = spanOf(digest.events);
  return {
    title: `${HEADING} — ${span ? `${span} ` : ''}${digest.events.length}件`,
    body: lines.join('\n')
  };
}

// The recipient-visible digest stays free of internal detail, so the cause is
// reported through an injected sink instead. Acceptance runs leave it silent;
// the scheduled run sends it to the workflow log, which only the repository
// owner reads, so a failed morning is diagnosable afterwards.
export async function deliver(notifier, digest) {
  const result = await notifier.send(digest, formatDigest(digest));
  if (!result.delivered) throw new Error(result.errorSummary ?? 'Notification delivery failed');
  return digest;
}

export async function runDailyDigest({ conditions, eventSource, notifier, now = new Date(), onFailure = () => {} }) {
  let digest;
  try {
    const events = await eventSource.fetch(conditions, now);
    digest = createDigest(normalizeEvents(events, conditions, now));
  } catch (error) {
    onFailure(error);
    digest = failedDigest();
  }
  return deliver(notifier, digest);
}
