#!/usr/bin/env bash
# Wires shell-greeting.sh into the user's shell rc file (~/.bashrc for bash, ~/.zshrc for zsh),
# so it fires once per day whenever a new terminal opens — regardless of which AI CLI (claude,
# codex, opencode, ...) they launch inside it afterwards. Idempotent: refuses to duplicate if a
# marked line already exists. Shows a preview and asks for confirmation before writing.
set -euo pipefail

if [[ $# -eq 0 ]]; then
  echo "usage: install-shell-hook.sh <schedule.json> [more files...]" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GREETING="$SCRIPT_DIR/shell-greeting.sh"
MARKER="# content-calendar-social-skills"
QUOTED_FILES=""
for f in "$@"; do
  ABS="$(cd "$(dirname "$f")" && pwd)/$(basename "$f")"
  QUOTED_FILES+=" $(printf '%q' "$ABS")"
done

case "$(basename "${SHELL:-}")" in
  zsh) RC="$HOME/.zshrc" ;;
  bash) RC="$HOME/.bashrc" ;;
  *)
    echo "Unrecognized \$SHELL (${SHELL:-unset}). Pass the rc file to edit as \$RC_FILE, e.g.:" >&2
    echo "  RC_FILE=~/.zshrc bash install-shell-hook.sh <schedule.json>" >&2
    RC="${RC_FILE:-}"
    [[ -z "$RC" ]] && exit 1
    ;;
esac

LINE="bash $(printf '%q' "$GREETING")$QUOTED_FILES $MARKER"

if [[ -f "$RC" ]] && grep -qF "$MARKER" "$RC"; then
  echo "A marked line ($MARKER) already exists in $RC. Remove it manually before reinstalling." >&2
  grep -F "$MARKER" "$RC" >&2
  exit 1
fi

echo "Will append this line to $RC:"
echo "----------------------------------------"
echo "$LINE"
echo "----------------------------------------"
read -rp "Confirm? (y/N) " CONFIRM
if [[ "$CONFIRM" =~ ^[yY]$ ]]; then
  printf '\n%s\n' "$LINE" >> "$RC"
  echo "Appended to $RC. Open a new terminal to see it fire."
else
  echo "Cancelled."
fi
