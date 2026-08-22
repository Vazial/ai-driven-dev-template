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
  assert.throws(() => parseInterestConditions('profiles:\n  - windowDays: 0\n'), /positive integer/);
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
