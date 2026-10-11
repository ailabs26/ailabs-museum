'use strict';
// Chạy: node --test .claude/hooks/lib/__tests__/freeze-check.test.cjs
// Sao chép hook vào thư mục tạm để KHÔNG đụng tới `.claude/.freeze-state` thật.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SRC_HOOKS = path.join(__dirname, '..', '..');
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'freeze-test-'));
const hooksDir = path.join(sandbox, 'hooks');
fs.mkdirSync(path.join(hooksDir, 'lib'), { recursive: true });
fs.copyFileSync(path.join(SRC_HOOKS, 'freeze-check.cjs'), path.join(hooksDir, 'freeze-check.cjs'));
fs.copyFileSync(path.join(SRC_HOOKS, 'lib', 'guard-hook-io.cjs'), path.join(hooksDir, 'lib', 'guard-hook-io.cjs'));

const HOOK = path.join(hooksDir, 'freeze-check.cjs');
const allowed = path.join(sandbox, 'src');
const sibling = path.join(sandbox, 'src-old'); // tên bắt đầu giống nhưng nằm ngoài
fs.mkdirSync(allowed);
fs.mkdirSync(sibling);

const cli = (...args) => spawnSync(process.execPath, [HOOK, ...args], { encoding: 'utf8' });
const hook = (toolInput) =>
  spawnSync(process.execPath, [HOOK], { input: JSON.stringify({ tool_input: toolInput }), encoding: 'utf8' });
const decision = (r) => (r.stdout ? JSON.parse(r.stdout).hookSpecificOutput.permissionDecision : null);

test.after(() => fs.rmSync(sandbox, { recursive: true, force: true }));

test('chưa đặt ranh giới -> cho qua mọi file', () => {
  assert.strictEqual(decision(hook({ file_path: path.join(sibling, 'a.txt') })), null);
});

test('--set với thư mục không tồn tại -> lỗi, không tạo state', () => {
  assert.notStrictEqual(cli('--set', path.join(sandbox, 'khong-co')).status, 0);
  assert.ok(!fs.existsSync(path.join(sandbox, '.freeze-state')));
});

test('đã đặt ranh giới: chặn file ngoài, cho file trong', () => {
  assert.strictEqual(cli('--set', allowed).status, 0);
  assert.strictEqual(decision(hook({ file_path: path.join(allowed, 'deep', 'new.ts') })), null);
  assert.strictEqual(decision(hook({ file_path: path.join(sandbox, 'other.ts') })), 'deny');
  assert.strictEqual(decision(hook({ file_path: path.join(sibling, 'a.txt') })), 'deny'); // src-old != src
  assert.strictEqual(decision(hook({ notebook_path: path.join(sandbox, 'n.ipynb') })), 'deny');
});

test('payload không có đường dẫn file -> cho qua; payload hỏng -> chặn', () => {
  assert.strictEqual(decision(hook({ command: 'ls' })), null);
  const r = spawnSync(process.execPath, [HOOK], { input: '{bad', encoding: 'utf8' });
  assert.strictEqual(decision(r), 'deny');
});

test('--status và --clear', () => {
  assert.match(cli('--status').stdout, /Ranh giới hiện tại/);
  assert.strictEqual(cli('--clear').status, 0);
  assert.match(cli('--status').stdout, /Chưa có ranh giới/);
  assert.strictEqual(decision(hook({ file_path: path.join(sandbox, 'other.ts') })), null);
});
