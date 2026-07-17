#!/usr/bin/env bash
# Installs the content-calendar reminder's cron line. Idempotent: refuses to duplicate if a
# marked line already exists. Shows a preview of the resulting crontab and asks for confirmation
# before writing.
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "usage: install-cron.sh <HH:MM> <schedule.json> [more files...]" >&2
  exit 1
fi

TIME="$1"; shift
HH="${TIME%%:*}"
MM="${TIME##*:}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REMINDER="$SCRIPT_DIR/reminder.sh"
MARKER="# content-calendar-social-skills"
QUOTED_FILES=""
for f in "$@"; do
  ABS="$(cd "$(dirname "$f")" && pwd)/$(basename "$f")"
  QUOTED_FILES+=" $(printf '%q' "$ABS")"
done
LINE="$MM $HH * * * /bin/bash $(printf '%q' "$REMINDER")$QUOTED_FILES $MARKER"

CURRENT="$(crontab -l 2>/dev/null || true)"
if printf '%s' "$CURRENT" | grep -qF "$MARKER"; then
  echo "A marked line ($MARKER) already exists in the crontab. Remove it manually (crontab -e) before reinstalling." >&2
  printf '%s\n' "$CURRENT" | grep -F "$MARKER" >&2
  exit 1
fi

NEW="$(printf '%s\n%s\n' "$CURRENT" "$LINE")"

echo "Preview of the crontab that will be installed:"
echo "----------------------------------------"
printf '%s\n' "$NEW"
echo "----------------------------------------"
read -rp "Confirm installation? (y/N) " CONFIRM
if [[ "$CONFIRM" =~ ^[yY]$ ]]; then
  printf '%s\n' "$NEW" | crontab -
  echo "Installed."
else
  echo "Cancelled."
fi
