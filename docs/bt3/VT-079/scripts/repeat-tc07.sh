#!/bin/bash
# Lặp TC07 (autosave song song) N lần để đo rủi ro flaky và tỷ lệ phát hiện mutation.
# Dùng: AUTOSAVE_TEST_DATABASE_URL=postgres://...@127.0.0.1:5433/aura_test \
#       DATABASE_URL=$AUTOSAVE_TEST_DATABASE_URL DATABASE_SSL=false \
#       docs/bt3/VT-079/scripts/repeat-tc07.sh back-end 30 "Patch"
DIR=${1:-back-end}; N=${2:-30}; LABEL=${3:-run}
case "$AUTOSAVE_TEST_DATABASE_URL" in *@localhost*|*@127.0.0.1*) ;; *) echo "Cần AUTOSAVE_TEST_DATABASE_URL trỏ localhost" >&2; exit 2;; esac
cd "$DIR" || exit 1
pass=0; fail=0
for _ in $(seq 1 "$N"); do
  if node -r reflect-metadata -r ts-node/register --test --test-name-pattern="TC07" \
      src/modules/exhibits/tests/exhibit-autosave.integration.spec.ts > /dev/null 2>&1; then pass=$((pass+1)); else fail=$((fail+1)); fi
done
echo "$LABEL: $N lần chạy TC07 (2 + 10 request song song) → pass=$pass fail=$fail"
