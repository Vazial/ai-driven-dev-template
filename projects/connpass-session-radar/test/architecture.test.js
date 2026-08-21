import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('L2: pure pipeline stages do not depend on environment or network adapters', async () => {
  const pipeline = await readFile(new URL('../src/pipeline.js', import.meta.url), 'utf8');
  assert.doesNotMatch(pipeline, /(?<!\.)\bfetch\s*\(|process\.env|node:fs|\.\/adapters/);
});
