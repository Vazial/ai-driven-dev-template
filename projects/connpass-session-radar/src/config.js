import { readFile } from 'node:fs/promises';

const LIST_KEYS = new Set(['keywords', 'keywordsAny', 'prefectures', 'groupIds']);
const PROFILE_KEYS = new Set([...LIST_KEYS, 'windowDays']);

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
    const line = originalLine.replace(/\s+#.*$/, '');
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
    if (item.windowDays !== undefined && (!Number.isInteger(item.windowDays) || item.windowDays < 1)) {
      throw new Error('windowDays must be a positive integer');
    }
    if (item.groupIds?.some((id) => !Number.isInteger(id))) throw new Error('groupIds must be integers');
    for (const key of ['keywords', 'keywordsAny', 'prefectures']) {
      if (item[key]) item[key] = item[key].map(String);
    }
  }
  return { profiles: profiles.map((profile) => ({ ...profile, windowDays: profile.windowDays ?? 7 })) };
}

export async function loadInterestConditions(path) {
  return parseInterestConditions(await readFile(path, 'utf8'));
}
