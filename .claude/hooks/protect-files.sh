#!/bin/bash
# protect-files.sh
# Chan Edit/Write vao cac file nhay cam.
# Khong phu thuoc cung vao jq: nhieu may (nhat la Windows) khong cai jq,
# truoc day hook im lang cho qua moi thao tac -> mat tac dung bao ve.

INPUT=$(cat)

extract_file_path() {
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty'
    return
  fi
  # Fallback: boc "file_path":"..." bang sed. Duong dan Windows trong JSON
  # con nguyen dau \ escape, nhung so khop pattern ben duoi van dung.
  printf '%s' "$INPUT" |
    sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' |
    head -1
}

FILE_PATH=$(extract_file_path)

PROTECTED_PATTERNS=(".env" "package-lock.json" ".git/")

for pattern in "${PROTECTED_PATTERNS[@]}"; do
  if [[ "$FILE_PATH" == *"$pattern"* ]]; then
    echo "Blocked: $FILE_PATH matches protected pattern '$pattern'" >&2
    exit 2
  fi
done

exit 0
