const DAY_MS = 24 * 60 * 60 * 1000;

export function isInWindow(startedAt, windowDays, now = new Date()) {
  if (startedAt == null) return true;
  const start = new Date(startedAt).getTime();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return start >= dayStart && start < dayStart + windowDays * DAY_MS;
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

export function normalizeEvents(events, conditions, now = new Date()) {
  const byUrl = new Map();
  for (const event of events) {
    if (event.open_status === 'cancelled') continue;
    const profile = event.matchedProfile ?? conditions.profiles.find((item) => matchesProfile(event, item));
    if (!profile || !isInWindow(event.started_at, profile.windowDays, now)) continue;

    const remainingSeatsKnown = event.event_type === 'participation' && event.limit != null;
    const remainingSeats = remainingSeatsKnown ? Math.max(0, event.limit - event.accepted) : null;
    const normalized = {
      title: event.title,
      url: event.url,
      startedAt: event.started_at ?? null,
      place: event.place ?? null,
      address: event.address ?? null,
      isOnline: event.prefecture === 'online',
      groupTitle: event.group?.title ?? null,
      eventType: event.event_type,
      remainingSeatsKnown,
      remainingSeats,
      isFull: remainingSeatsKnown && (remainingSeats === 0 || event.waiting > 0)
    };
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

export function formatDigest(digest) {
  if (digest.status === 'failed') return `Connpass Session Radar\n${digest.failureReason}`;
  if (digest.status === 'zero') return 'Connpass Session Radar\n今日は該当するイベントはありません。';
  return ['Connpass Session Radar', ...digest.events.flatMap((event) => {
    const place = event.isOnline ? 'オンライン' : [event.place, event.address].filter(Boolean).join(' / ') || '開催場所未定';
    const capacity = !event.remainingSeatsKnown
      ? (event.eventType === 'advertisement' ? null : '定員なし')
      : (event.isFull ? '満席' : `残席目安: ${event.remainingSeats}`);
    return [
      `\n${event.title}`,
      `日時: ${event.startedAt ?? '日時未定'}`,
      `場所: ${place}`,
      event.groupTitle ? `主催: ${event.groupTitle}` : null,
      capacity,
      event.url
    ].filter(Boolean);
  })].join('\n');
}

export async function runDailyDigest({ conditions, eventSource, notifier, now = new Date() }) {
  let digest;
  try {
    const events = await eventSource.fetch(conditions, now);
    digest = createDigest(normalizeEvents(events, conditions, now));
  } catch {
    digest = failedDigest();
  }
  const result = await notifier.send(digest, formatDigest(digest));
  if (!result.delivered) throw new Error(result.errorSummary ?? 'Notification delivery failed');
  return digest;
}
