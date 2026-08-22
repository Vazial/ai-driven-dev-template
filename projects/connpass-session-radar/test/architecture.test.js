import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// Matches a call to the global fetch, not a `fetch` method implementing the port.
const ADAPTER_DEPENDENCY = /(?<!\.)(?<!async )\bfetch\s*\(|process\.env|node:fs|\.\/adapters/;

test('L2: pure pipeline stages do not depend on environment or network adapters', async () => {
  const pipeline = await readFile(new URL('../src/pipeline.js', import.meta.url), 'utf8');
  assert.doesNotMatch(pipeline, ADAPTER_DEPENDENCY);
});

test('L2: acceptance seams never reach a real provider or a secret', async () => {
  for (const file of ['acceptance-support.js', 'acceptance-bridge.js']) {
    const source = await readFile(new URL(`../src/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, ADAPTER_DEPENDENCY, `${file} must stay free of provider I/O`);
  }
});
