#!/usr/bin/env bash
# Prints today's content-calendar entries once per day, meant to be called (not sourced) from
# the shell rc file (.bashrc/.zshrc) so it surfaces the moment a terminal opens — agnostic of
# which CLI/agent (claude, codex, opencode, plain shell) gets used in that terminal afterwards.
# Silent on every run after the first one today, so opening many tabs doesn't spam the same
# reminder repeatedly.
set -euo pipefail

if [[ $# -eq 0 ]]; then
  exit 0
fi

TODAY="$(date +%F)"
MARKER="$HOME/.content-calendar-last-shown"

if [[ -f "$MARKER" && "$(cat "$MARKER" 2>/dev/null)" == "$TODAY" ]]; then
  exit 0
fi

MSG=""
for FILE in "$@"; do
  [[ -f "$FILE" ]] || continue
  ENTRIES="$(node -e '
    const fs = require("fs");
    const today = process.argv[1];
    const data = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
    for (const e of data) {
      if (e.date === today) console.log(`${e.brand} - ${e.channel} - ${e.type} - ${e.theme}`);
    }
  ' "$TODAY" "$FILE" 2>/dev/null || true)"
  [[ -n "$ENTRIES" ]] && MSG+="$ENTRIES"$'\n'
done

echo "$TODAY" > "$MARKER"

[[ -z "$MSG" ]] && exit 0

echo ""
echo "-- content calendar: today ($TODAY) --"
printf '%s' "$MSG"
echo "----------------------------------------"
