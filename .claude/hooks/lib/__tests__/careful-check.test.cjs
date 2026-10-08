'use strict';
// Chạy: node --test .claude/hooks/lib/__tests__/careful-check.test.cjs
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { spawnSync } = require('child_process');
const { evaluateCommand } = require('../../careful-check.cjs');

const level = (cmd) => evaluateCommand(cmd)?.level ?? null;

test('cho qua lệnh thường', () => {
  for (const c of ['ls -la', 'git status', 'git push origin feature/x', 'rm file.txt', 'git commit -m "update docs"', 'docker ps']) {
    assert.strictEqual(level(c), null, c);
  }
});

test('rm đệ quy: cảnh báo, ngoại lệ thư mục sinh ra', () => {
  assert.strictEqual(level('rm -rf /var/data'), 'ask');
  assert.strictEqual(level('rm -r ./src'), 'ask');
  assert.strictEqual(level('rm --recursive tmp'), 'ask');
  assert.strictEqual(level('rm -rf node_modules'), null);
  assert.strictEqual(level('rm -rf ./dist/ .next'), null);
  assert.strictEqual(level('rm -rf node_modules src'), 'ask');
});

test('rm đệ quy vào /, ~, $HOME: chặn hẳn khi là lệnh đơn giản', () => {
  for (const c of ['rm -rf /', 'rm -rf ~', 'rm -rf $HOME', 'sudo rm -rf /*']) {
    assert.strictEqual(level(c), 'deny', c);
  }
  // Lệnh ghép chỉ hạ xuống ask
  assert.strictEqual(level('cd x && rm -rf /'), 'ask');
});

test('lệnh phá hoại nằm sau tham số có dấu nháy vẫn bị bắt', () => {
  assert.strictEqual(level('git commit -m "wip" && rm -rf src'), 'ask');
  assert.strictEqual(level('bash -c "rm -rf src"'), 'ask');
});

test('git', () => {
  assert.strictEqual(level('git push -f origin feature'), 'ask');
  assert.strictEqual(level('git push --force-with-lease origin feature'), 'ask');
  assert.strictEqual(level('git push --force origin main'), 'deny');
  assert.strictEqual(level('git push -f origin HEAD:master'), 'deny');
  assert.strictEqual(level('git push --force-with-lease origin main'), 'ask');
  assert.strictEqual(level('git reset --hard HEAD~3'), 'ask');
  assert.strictEqual(level('git checkout .'), 'ask');
  assert.strictEqual(level('git restore .'), 'ask');
  assert.strictEqual(level('git restore --staged .'), null);
  assert.strictEqual(level('git checkout main'), null);
  assert.strictEqual(level('git clean -fd'), 'ask');
  assert.strictEqual(level('git clean -n'), null);
});

test('SQL, kubectl, docker', () => {
  assert.strictEqual(level('psql -c "DROP TABLE users;"'), 'ask');
  assert.strictEqual(level('psql -c "truncate orders"'), 'ask');
  assert.strictEqual(level('kubectl delete pod web-1'), 'ask');
  assert.strictEqual(level('docker system prune -a'), 'ask');
  assert.strictEqual(level('docker rm -f web'), 'ask');
  assert.strictEqual(level('docker rm web'), null);
});

test('PowerShell / cmd Windows', () => {
  assert.strictEqual(level('Remove-Item -Recurse -Force C:\\data'), 'ask');
  assert.strictEqual(level('Remove-Item -Force notes.txt'), null);
  assert.strictEqual(level('Remove-Item -Recurse node_modules'), null);
  assert.strictEqual(level('rd /s /q build\\out'), 'ask');
  assert.strictEqual(level('del /s /q *.log'), 'ask');
});

// --- Kiểm thử hook qua stdin/stdout ---
const HOOK = path.join(__dirname, '..', '..', 'careful-check.cjs');
const run = (input) => spawnSync(process.execPath, [HOOK], { input, encoding: 'utf8' });

test('hook: ask/deny đặt trong hookSpecificOutput', () => {
  const out = JSON.parse(run(JSON.stringify({ tool_input: { command: 'git reset --hard' } })).stdout);
  assert.strictEqual(out.hookSpecificOutput.permissionDecision, 'ask');
  const deny = JSON.parse(run(JSON.stringify({ tool_input: { command: 'rm -rf ~' } })).stdout);
  assert.strictEqual(deny.hookSpecificOutput.permissionDecision, 'deny');
});

test('hook: lệnh an toàn và payload không có command -> không xuất gì', () => {
  assert.strictEqual(run(JSON.stringify({ tool_input: { command: 'ls' } })).stdout, '');
  assert.strictEqual(run(JSON.stringify({ tool_input: { file_path: 'a.txt' } })).stdout, '');
  assert.strictEqual(run('').stdout, '');
});

test('hook: payload hỏng -> fail-closed (ask)', () => {
  const out = JSON.parse(run('{not json').stdout);
  assert.strictEqual(out.hookSpecificOutput.permissionDecision, 'ask');
});
