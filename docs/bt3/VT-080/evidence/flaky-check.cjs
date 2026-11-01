// Run from back-end/. Each test invocation is an isolated process.
const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');

const restore = 'src/modules/users/tests/users-restore.spec.ts';
const http = 'src/common/tests/rbac-http.integration.spec.ts';
if (!existsSync(restore)) throw new Error('Run this script from back-end/');

function run(label, files, env = process.env) {
  const result = spawnSync(process.execPath, [
    '-r', 'reflect-metadata', '-r', 'ts-node/register', '--test', ...files,
  ], { env, encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stdout + result.stderr);
    throw new Error(`${label}: exit ${result.status}`);
  }
  process.stdout.write(`${label}: pass\n`);
}

for (let index = 1; index <= 10; index += 1) run(`restore-repeat-${index}`, [restore]);
for (const TZ of ['UTC', 'Asia/Ho_Chi_Minh']) {
  run(`timezone-${TZ}`, [restore, http], { ...process.env, TZ });
}
run('restore-first', [restore, http]);
run('http-first', [http, restore]);
