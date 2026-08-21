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
