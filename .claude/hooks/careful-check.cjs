'use strict';
/**
 * careful-check.cjs — PreToolUse hook cho skill /careful.
 * Cảnh báo (ask) trước các lệnh phá hoại; chặn hẳn (deny) vài dạng thảm họa.
 * Áp dụng cho tool Bash và PowerShell (trường `tool_input.command`).
 *
 * Ý tưởng và danh sách mẫu lệnh tham khảo /careful của garrytan/gstack (MIT),
 * viết lại bằng Node để chạy trên Windows, không cần bash/jq/telemetry.
 *
 * Giới hạn: kiểm tra theo chuỗi lệnh, chỉ là lớp cảnh báo, KHÔNG phải ranh giới bảo mật.
 */
const path = require('path');
const { readHookInput, emitDecision } = require('./lib/guard-hook-io.cjs');

// Thư mục sinh ra được phép xóa đệ quy không cần cảnh báo
const SAFE_RM_TARGETS = new Set([
  'node_modules', '.next', 'dist', '__pycache__', '.cache', 'build', '.turbo', 'coverage',
]);
// Đích xóa đệ quy bị chặn hẳn (chỉ khi là lệnh đơn giản)
const CATASTROPHIC_TARGETS = new Set([
  '/', '/*', '~', '~/', '$HOME', '$HOME/', '${HOME}', '${HOME}/',
]);
const DEFAULT_BRANCH_REF = /(^|[:+/])(main|master)$/;
const SQL_DESTRUCTIVE = /\bDROP\s+(TABLE|DATABASE|SCHEMA)\b|\bTRUNCATE\b/i;

const stripQuotes = (t) => t.replace(/^['"`]+|['"`]+$/g, '');
const tokenize = (seg) => seg.trim().split(/\s+/).map(stripQuotes).filter(Boolean);
const has = (toks, word) => toks.includes(word);

/** Tên cuối của đường dẫn, chuẩn hóa dấu gạch và bỏ '/' đuôi. */
function baseName(t) {
  return path.posix.basename(t.replace(/\\/g, '/').replace(/\/+$/, ''));
}

/** Tất cả đích đều là thư mục sinh ra an toàn thì mới được bỏ qua cảnh báo. */
function allTargetsSafe(targets) {
  return targets.length > 0 && targets.every((t) => SAFE_RM_TARGETS.has(baseName(t)));
}

/** rm -r, Remove-Item -Recurse, rd/rmdir/del /s */
function checkRecursiveDelete(toks, simple) {
  const idx = toks.findIndex((t) => /^(rm|remove-item|ri|rd|rmdir|del|erase)$/i.test(t));
  if (idx === -1) return null;
  const cmd = toks[idx].toLowerCase();
  const rest = toks.slice(idx + 1);

  let recursive;
  if (cmd === 'rm') {
    recursive = rest.some((t) => /^-[a-zA-Z]*[rR][a-zA-Z]*$/.test(t) || t === '--recursive');
  } else if (cmd === 'remove-item' || cmd === 'ri') {
    recursive = rest.some((t) => /^-recurse$/i.test(t));
  } else {
    recursive = rest.some((t) => t.toLowerCase() === '/s');
  }
  if (!recursive) return null;

  const targets = rest.filter((t) => !t.startsWith('-') && !(cmd !== 'rm' && t.startsWith('/')));
  if (simple && cmd === 'rm' && targets.some((t) => CATASTROPHIC_TARGETS.has(t))) {
    return { level: 'deny', reason: `[careful] Chặn: xóa đệ quy thư mục gốc/home (${targets.join(' ')}).` };
  }
  if (allTargetsSafe(targets)) return null;
  return { level: 'ask', reason: '[careful] Xóa đệ quy — mất dữ liệu không thể hoàn tác.' };
}

/** git push -f, reset --hard, checkout ., restore ., clean -f */
function checkGit(toks, simple) {
  if (!has(toks, 'git')) return null;

  if (has(toks, 'push')) {
    const hardForce = toks.some((t) => t === '--force' || /^-[a-zA-Z]*f[a-zA-Z]*$/.test(t));
    const lease = toks.some((t) => t.startsWith('--force-with-lease'));
    const plusRef = toks.some((t) => t.startsWith('+') && t.length > 1);
    if (hardForce || lease || plusRef) {
      const onDefault = toks.some((t) => DEFAULT_BRANCH_REF.test(t.replace(/^\+/, '')));
      if (simple && (hardForce || plusRef) && onDefault) {
        return { level: 'deny', reason: '[careful] Chặn: force-push lên nhánh mặc định (main/master).' };
      }
      return { level: 'ask', reason: '[careful] git push --force — ghi đè lịch sử trên remote.' };
    }
  }
  if (has(toks, 'reset') && has(toks, '--hard')) {
    return { level: 'ask', reason: '[careful] git reset --hard — mất thay đổi chưa commit.' };
  }
  if ((has(toks, 'checkout') || has(toks, 'restore')) && toks.includes('.')) {
    const stagedOnly = has(toks, '--staged') && !has(toks, '--worktree');
    if (!stagedOnly) {
      return { level: 'ask', reason: '[careful] Hoàn tác toàn bộ thay đổi chưa commit (checkout/restore .).' };
    }
  }
  if (has(toks, 'clean') && toks.some((t) => t === '--force' || /^-[a-zA-Z]*f[a-zA-Z]*$/.test(t))) {
    return { level: 'ask', reason: '[careful] git clean -f — xóa file chưa được theo dõi.' };
  }
  return null;
}

/** kubectl delete, docker rm -f, docker ... prune */
function checkInfra(toks) {
  if (has(toks, 'kubectl') && has(toks, 'delete')) {
    return { level: 'ask', reason: '[careful] kubectl delete — tác động lên cụm đang chạy.' };
  }
  if (has(toks, 'docker')) {
    const forceRm = has(toks, 'rm') && (has(toks, '-f') || has(toks, '--force'));
    if (forceRm || has(toks, 'prune')) {
      return { level: 'ask', reason: '[careful] Docker rm -f / prune — mất container, image hoặc volume.' };
    }
  }
  return null;
}

/**
 * Đánh giá một chuỗi lệnh.
 * @returns {{level: 'ask'|'deny', reason: string}|null} null = cho qua
 */
function evaluateCommand(command) {
  const cmd = String(command || '');
  const simple = !/[;&|\n]/.test(cmd.trim());
  let ask = null;

  for (const seg of cmd.split(/&&|\|\||[;|\n]/)) {
    const toks = tokenize(seg);
    if (!toks.length) continue;
    const hit = checkRecursiveDelete(toks, simple) || checkGit(toks, simple) || checkInfra(toks);
    if (hit?.level === 'deny') return hit;
    if (hit && !ask) ask = hit;
  }
  if (!ask && SQL_DESTRUCTIVE.test(cmd)) {
    ask = { level: 'ask', reason: '[careful] SQL DROP/TRUNCATE — mất dữ liệu.' };
  }
  return ask;
}

function main() {
  const input = readHookInput();
  // Fail-closed: payload có nhưng không đọc được thì hỏi lại thay vì im lặng cho qua
  if (input.error) {
    emitDecision('ask', '[careful] Không đọc được payload để kiểm tra lệnh này. Chỉ duyệt nếu bạn biết lệnh làm gì.');
    return;
  }
  const command = input.data?.tool_input?.command;
  if (typeof command !== 'string') return;

  const result = evaluateCommand(command);
  if (result) emitDecision(result.level, result.reason);
}

if (require.main === module) main();
module.exports = { evaluateCommand };
