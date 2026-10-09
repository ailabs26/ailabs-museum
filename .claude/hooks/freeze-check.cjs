'use strict';
/**
 * freeze-check.cjs — PreToolUse hook cho skill /freeze.
 * Chặn (deny) Edit/Write/MultiEdit/NotebookEdit ngoài thư mục đã "đóng băng".
 *
 * Dùng cả làm CLI quản lý trạng thái:
 *   node .claude/hooks/freeze-check.cjs --set <thư-mục>   đặt ranh giới
 *   node .claude/hooks/freeze-check.cjs --clear           gỡ ranh giới
 *   node .claude/hooks/freeze-check.cjs --status          xem ranh giới hiện tại
 *
 * Trạng thái lưu tại `.claude/.freeze-state` (cạnh script, không phụ thuộc cwd/env).
 * Ý tưởng tham khảo /freeze của garrytan/gstack (MIT), viết lại bằng Node.
 *
 * Giới hạn: chỉ chặn công cụ sửa file; lệnh shell (sed, Set-Content...) vẫn ghi được.
 * Đây là lớp chống sửa nhầm, KHÔNG phải ranh giới bảo mật.
 */
const fs = require('fs');
const path = require('path');
const { readHookInput, emitDecision } = require('./lib/guard-hook-io.cjs');

const STATE_FILE = path.join(__dirname, '..', '.freeze-state');
const CASE_INSENSITIVE = process.platform === 'win32';

/**
 * Đường dẫn tuyệt đối đã giải symlink / tên rút gọn 8.3.
 * File hoặc thư mục con chưa tồn tại: giải phần tổ tiên gần nhất còn tồn tại rồi nối phần còn lại.
 */
function realPath(p) {
  const abs = path.resolve(p);
  const missing = [];
  let cur = abs;
  for (;;) {
    try {
      return path.join(fs.realpathSync.native(cur), ...missing.reverse());
    } catch {
      const parent = path.dirname(cur);
      if (parent === cur) return abs; // tới gốc mà vẫn không giải được
      missing.push(path.basename(cur));
      cur = parent;
    }
  }
}

const fold = (p) => (CASE_INSENSITIVE ? p.toLowerCase() : p);

/** Dấu '/' cuối ngăn `/src` khớp nhầm `/src-old`. */
function isInside(file, dir) {
  const f = fold(file);
  const d = fold(dir.endsWith(path.sep) ? dir : dir + path.sep);
  return f === d.slice(0, -1) || f.startsWith(d);
}

function readBoundary() {
  try {
    return fs.readFileSync(STATE_FILE, 'utf8').trim() || null;
  } catch {
    return null;
  }
}

function runCli(args) {
  const [flag, target] = args;
  if (flag === '--set') {
    if (!target || !fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
      console.error(`Thư mục không tồn tại: ${target || '(trống)'}`);
      process.exit(1);
    }
    const dir = realPath(target);
    fs.writeFileSync(STATE_FILE, dir, 'utf8');
    console.log(`Đã đóng băng: chỉ cho phép sửa trong ${dir}`);
  } else if (flag === '--clear') {
    const prev = readBoundary();
    fs.rmSync(STATE_FILE, { force: true });
    console.log(prev ? `Đã gỡ ranh giới (trước đó: ${prev})` : 'Chưa có ranh giới nào.');
  } else {
    console.log(readBoundary() ? `Ranh giới hiện tại: ${readBoundary()}` : 'Chưa có ranh giới nào.');
  }
}

function main() {
  const input = readHookInput();
  // Fail-closed: không đọc được payload thì chặn
  if (input.error) {
    emitDecision('deny', '[freeze] Không đọc được payload nên chặn thao tác sửa file để an toàn.');
    return;
  }
  const boundary = readBoundary();
  if (!boundary) return;

  const toolInput = input.data?.tool_input || {};
  const filePath = toolInput.file_path || toolInput.notebook_path;
  if (typeof filePath !== 'string') return; // không phải công cụ sửa file

  if (!isInside(realPath(filePath), boundary)) {
    emitDecision('deny', `[freeze] Chỉ được sửa trong ${boundary}. Dùng /freeze để đổi hoặc gỡ ranh giới.`);
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length) runCli(args);
  else main();
}
module.exports = { isInside, realPath };
