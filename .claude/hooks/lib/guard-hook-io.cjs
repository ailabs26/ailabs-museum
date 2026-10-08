'use strict';
/**
 * Tiện ích I/O dùng chung cho các hook bảo vệ PreToolUse (careful-check, freeze-check).
 * Đọc JSON payload từ stdin và phát quyết định theo đúng định dạng Claude Code:
 * quyết định PHẢI nằm trong `hookSpecificOutput`, đặt ở cấp ngoài cùng sẽ bị bỏ qua.
 */
const fs = require('fs');

/**
 * Đọc và parse payload từ stdin.
 * @returns {{raw: string, data: object|null, error: boolean}}
 *   error=true khi payload không rỗng nhưng không parse được -> hook gọi phải fail-closed.
 */
function readHookInput() {
  let raw = '';
  try {
    raw = fs.readFileSync(0, 'utf8');
  } catch {
    return { raw: '', data: null, error: false };
  }
  if (!raw.trim()) return { raw, data: null, error: false };
  try {
    return { raw, data: JSON.parse(raw), error: false };
  } catch {
    return { raw, data: null, error: true };
  }
}

/**
 * Phát quyết định cho PreToolUse.
 * @param {'ask'|'deny'|'allow'} decision
 * @param {string} reason Lý do hiển thị cho người dùng
 */
function emitDecision(decision, reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: decision,
        permissionDecisionReason: reason,
      },
    }) + '\n'
  );
}

module.exports = { readHookInput, emitDecision };
