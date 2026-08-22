const TOKYO_TIME_ZONE = 'Asia/Tokyo';
const TOKYO_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function tokyoDateParts(value) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TOKYO_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(value);
  return Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value: part }) => [type, Number(part)]));
}

export function tokyoMidnight(value) {
  const { year, month, day } = tokyoDateParts(value);
  return new Date(Date.UTC(year, month - 1, day) - TOKYO_OFFSET_MS);
}

export function addTokyoDays(value, days) {
  return new Date(tokyoMidnight(value).getTime() + days * DAY_MS);
}

export function tokyoYmd(value) {
  const { year, month, day } = tokyoDateParts(value);
  return `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
}

// Recipient-facing labels. The digest is read at breakfast, so it carries the
// Tokyo wall clock the events are announced in, not the machine timestamp.
export function tokyoDayLabel(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: TOKYO_TIME_ZONE, month: 'numeric', day: 'numeric', weekday: 'short'
  }).format(date);
}

export function tokyoTimeLabel(value) {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: TOKYO_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(new Date(value));
}
