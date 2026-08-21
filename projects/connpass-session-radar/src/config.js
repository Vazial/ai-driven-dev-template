import { readFile } from 'node:fs/promises';

const LIST_KEYS = new Set(['keywords', 'keywordsAny', 'prefectures', 'groupIds']);

function scalar(value) {
  const trimmed = value.trim();
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed.replace(/^['"]|['"]$/g, '');
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
        profile[key] = value === '' ? [] : scalar(value);
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
        profile[key] = value.slice(1, -1).split(',').filter(Boolean).map(scalar);
        listKey = undefined;
      } else {
        profile[key] = value === '' && LIST_KEYS.has(key) ? [] : scalar(value);
        listKey = value === '' && LIST_KEYS.has(key) ? key : undefined;
      }
      continue;
    }

    throw new Error(`Unsupported interest-conditions YAML line: ${originalLine}`);
  }

  if (profiles.length === 0) throw new Error('interest conditions require at least one profile');
  for (const item of profiles) {
    if (item.windowDays !== undefined && (!Number.isInteger(item.windowDays) || item.windowDays < 1)) {
      throw new Error('windowDays must be a positive integer');
    }
    if (item.groupIds?.some((id) => !Number.isInteger(id))) throw new Error('groupIds must be integers');
  }
  return { profiles: profiles.map((profile) => ({ ...profile, windowDays: profile.windowDays ?? 7 })) };
}

export async function loadInterestConditions(path) {
  return parseInterestConditions(await readFile(path, 'utf8'));
}
