import { readFile } from 'node:fs/promises';

const LIST_KEYS = new Set(['keywords', 'keywordsAny', 'prefectures', 'groupIds']);
const DAY_KEYS = ['windowDays', 'startsInDays', 'publishedWithinDays'];
const PROFILE_KEYS = new Set([...LIST_KEYS, ...DAY_KEYS]);

function scalar(value) {
  const trimmed = value.trim();
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed.replace(/^['"]|['"]$/g, '');
}

// A misspelled field would otherwise be dropped silently, and a profile whose
// filters all vanish matches every connpass event in the window. The contract
// declares InterestProfile as additionalProperties: false, so refuse instead.
function assign(profile, key, value, originalLine) {
  if (!PROFILE_KEYS.has(key)) {
    throw new Error(`Unknown interest-conditions field '${key}': ${originalLine.trim()}`);
  }
  profile[key] = value;
}

// The profile file deliberately has a small, documented YAML surface: a top-level
// profiles sequence, scalar fields, and string/integer sequences. Keeping it here
// avoids a runtime dependency for a daily batch job.
export function parseInterestConditions(yaml) {
  const profiles = [];
  let profile;
  let listKey;

  for (const originalLine of yaml.split(/\r?\n/)) {
    // A comment at column zero was rejected as an unsupported line, which made
    // it impossible to label the profiles in the one file a person hand-edits.
    const line = originalLine.replace(/(^\s*|\s+)#.*$/, '');
    if (!line.trim()) continue;
    if (line === 'profiles:') continue;

    const profileStart = line.match(/^\s{2}-\s*(?:(\w+):\s*(.*))?$/);
    if (profileStart) {
      profile = {};
      profiles.push(profile);
      listKey = undefined;
      if (profileStart[1]) {
        const [, key, value] = profileStart;
        assign(profile, key, value === '' ? [] : scalar(value), originalLine);
        listKey = value === '' ? key : undefined;
      }
      continue;
    }

    const entry = line.match(/^\s{6,}-\s+(.+)$/);
    if (entry && profile && listKey) {
      profile[listKey].push(scalar(entry[1]));
      continue;
    }

    const field = line.match(/^\s{4}(\w+):\s*(.*)$/);
    if (field && profile) {
      const [, key, value] = field;
      if (value.startsWith('[') && value.endsWith(']')) {
        assign(profile, key, value.slice(1, -1).split(',').filter(Boolean).map(scalar), originalLine);
        listKey = undefined;
      } else {
        const isEmptyList = value === '' && LIST_KEYS.has(key);
        assign(profile, key, isEmptyList ? [] : scalar(value), originalLine);
        listKey = isEmptyList ? key : undefined;
      }
      continue;
    }

    throw new Error(`Unsupported interest-conditions YAML line: ${originalLine}`);
  }

  if (profiles.length === 0) throw new Error('interest conditions require at least one profile');
  for (const item of profiles) {
    for (const key of LIST_KEYS) {
      if (item[key] !== undefined && !Array.isArray(item[key])) {
        throw new Error(`${key} must be a list`);
      }
    }
    for (const key of DAY_KEYS) {
      const floor = key === 'startsInDays' ? 0 : 1;
      if (item[key] !== undefined && (!Number.isInteger(item[key]) || item[key] < floor)) {
        throw new Error(`${key} must be an integer of at least ${floor}`);
      }
    }
    // The two axes ask connpass different questions (publish_ymd vs ymd) and the
    // API does not say how they combine, so a profile may only use one of them.
    if (item.publishedWithinDays !== undefined
      && (item.windowDays !== undefined || item.startsInDays !== undefined)) {
      throw new Error('publishedWithinDays cannot be combined with windowDays or startsInDays');
    }
    if (item.groupIds?.some((id) => !Number.isInteger(id))) throw new Error('groupIds must be integers');
    for (const key of ['keywords', 'keywordsAny', 'prefectures']) {
      if (item[key]) item[key] = item[key].map(String);
    }
  }
  return {
    profiles: profiles.map((profile) => (profile.publishedWithinDays
      ? profile
      : { ...profile, windowDays: profile.windowDays ?? 7 }))
  };
}

export async function loadInterestConditions(path) {
  return parseInterestConditions(await readFile(path, 'utf8'));
}
