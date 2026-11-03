#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { PassThrough } = require('node:stream');
const { test } = require('node:test');

const {
  normalizeTimeout,
  readStatuslineInput,
  readStream
} = require('../statusline-stdin-reader.cjs');

test('normalizeTimeout accepts only positive integer values', () => {
  assert.equal(normalizeTimeout('25'), 25);
  assert.equal(normalizeTimeout('0'), 0);
  assert.equal(normalizeTimeout('-1'), 0);
  assert.equal(normalizeTimeout('invalid'), 0);
});

test('readStream resolves empty input', async () => {
  const stream = new PassThrough();
  const pendingRead = readStream(stream);
  stream.end();
  assert.equal(await pendingRead, '');
});

test('readStatuslineInput preserves valid and invalid payload text', async () => {
  for (const input of ['{"ok":true}', '{invalid-json']) {
    const stream = new PassThrough();
    const pendingRead = readStatuslineInput({ stream });
    stream.end(input);
    assert.equal(await pendingRead, input);
  }
});

test('readStream joins delayed chunks without spawning a process', async () => {
  const stream = new PassThrough();
  const pendingRead = readStream(stream, { timeoutMs: 200 });
  stream.write('{"delayed":');
  setTimeout(() => stream.end('true}'), 20);
  assert.equal(await pendingRead, '{"delayed":true}');
});

test('readStream rejects after an inactivity timeout', async () => {
  const stream = new PassThrough();
  await assert.rejects(
    readStream(stream, { timeoutMs: 20 }),
    /stdin timeout after 20ms/
  );
  stream.destroy();
});
