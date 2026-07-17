#!/usr/bin/env bash
# Daily content-calendar reminder — reads one or more schedule.json files and notifies whatever
# is due today. Agent-agnostic: meant to run via the system cron, not tied to any AI session
# being open at the moment it fires.
set -euo pipefail

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
  shift
fi

if [[ $# -eq 0 ]]; then
  echo "usage: reminder.sh [--dry-run] <schedule.json> [more files...]" >&2
  exit 1
fi

TODAY="$(date +%F)"
LOG="$HOME/.content-calendar-reminders.log"
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

if [[ -z "$MSG" ]]; then
  [[ $DRY_RUN -eq 1 ]] && echo "Nothing scheduled for today ($TODAY)."
  exit 0
fi

if [[ $DRY_RUN -eq 1 ]]; then
  echo "Would fire today ($TODAY):"
  printf '%s' "$MSG"
  exit 0
fi

{ printf '%s ' "$(date '+%F %T')"; printf '%s' "$MSG"; } >> "$LOG"

if command -v notify-send &>/dev/null; then
  notify-send "Content calendar - today" "$MSG"
elif command -v osascript &>/dev/null; then
  osascript -e "display notification \"$(printf '%s' "$MSG" | tr '\n' ' ')\" with title \"Content calendar - today\""
else
  printf '%s' "$MSG"
fi
