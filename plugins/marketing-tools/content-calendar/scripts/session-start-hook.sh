#!/usr/bin/env bash
# Claude Code SessionStart hook: if there's a content-calendar entry for today, emits it as
# additionalContext so Claude proactively knows about it at session start. This is the one
# Claude-Code-specific integration in this skill — every other mechanism (cron, shell-startup
# greeting) is plain OS-level and works no matter which agent/terminal is used. Silent (no
# stdout) when nothing is due today, so it doesn't add noise to every session.
set -euo pipefail

[[ $# -eq 0 ]] && exit 0

TODAY="$(date +%F)"
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

[[ -z "$MSG" ]] && exit 0

CONTEXT="Content calendar has an entry due today ($TODAY): $(printf '%s' "$MSG" | tr '\n' ';' | sed 's/;$//'). If the user hasn't mentioned it, feel free to bring it up early in the conversation."

node -e '
  const context = process.argv[1];
  console.log(JSON.stringify({ hookSpecificOutput: { additionalContext: context, hookEventName: "SessionStart" } }));
' "$CONTEXT"
