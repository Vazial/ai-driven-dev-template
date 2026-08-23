import assert from 'node:assert/strict';
import test from 'node:test';
import { parseInterestConditions } from '../src/config.js';

test('loads committed YAML profiles and supplies the seven-day default', () => {
  assert.deepEqual(parseInterestConditions(`profiles:
  - keywords:
      - AWS
    keywordsAny: [cloud, serverless]
    prefectures:
      - online
    groupIds:
      - 42
  - windowDays: 3
`), {
    profiles: [
      { keywords: ['AWS'], keywordsAny: ['cloud', 'serverless'], prefectures: ['online'], groupIds: [42], windowDays: 7 },
      { windowDays: 3 }
    ]
  });
});

test('rejects profiles without a positive window', () => {
  assert.throws(() => parseInterestConditions('profiles:\n  - windowDays: 0\n'), /windowDays must be an integer of at least 1/);
});

test('a profile picks one axis: publish date or start date, never both', () => {
  assert.deepEqual(parseInterestConditions('profiles:\n  - publishedWithinDays: 1\n'),
    { profiles: [{ publishedWithinDays: 1 }] });
  assert.deepEqual(parseInterestConditions('profiles:\n  - startsInDays: 7\n    windowDays: 1\n'),
    { profiles: [{ startsInDays: 7, windowDays: 1 }] });
  assert.throws(() => parseInterestConditions('profiles:\n  - publishedWithinDays: 1\n    windowDays: 3\n'),
    /cannot be combined/);
  assert.throws(() => parseInterestConditions('profiles:\n  - publishedWithinDays: 1\n    startsInDays: 7\n'),
    /cannot be combined/);
  assert.throws(() => parseInterestConditions('profiles:\n  - startsInDays: -1\n'),
    /startsInDays must be an integer of at least 0/);
});

test('refuses a misspelled field instead of silently dropping every filter', () => {
  assert.throws(() => parseInterestConditions('profiles:\n  - keywordAny:\n      - AWS\n'),
    /Unknown interest-conditions field 'keywordAny'/);
  assert.throws(() => parseInterestConditions('profiles:\n  - keywords:\n      - AWS\n    windowDayz: 3\n'),
    /Unknown interest-conditions field 'windowDayz'/);
});

test('refuses a bare scalar where the contract declares a list', () => {
  assert.throws(() => parseInterestConditions('profiles:\n  - keywords: AWS\n'), /keywords must be a list/);
});

test('keeps numeric-looking keywords as text', () => {
  assert.deepEqual(parseInterestConditions('profiles:\n  - keywords:\n      - 2026\n').profiles[0].keywords, ['2026']);
});

test('accepts a comment at column zero, where the profile labels live', () => {
  assert.deepEqual(parseInterestConditions(`# 興味の条件
profiles:
  # AI/LLM
  - keywordsAny:
      - LLM
    windowDays: 3
`), { profiles: [{ keywordsAny: ['LLM'], windowDays: 3 }] });
});

test('keeps a hash that belongs to the value, such as C#', () => {
  assert.deepEqual(parseInterestConditions('profiles:\n  - keywordsAny:\n      - C#\n      - .NET\n').profiles[0].keywordsAny, ['C#', '.NET']);
});
