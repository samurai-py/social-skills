---
name: content-calendar
description: Generates a posting schedule by cross-referencing the brands in user/plugins/, their channels, and the available post types (including canva-killer visual templates), then wires up a daily reminder via system cron — agnostic of whatever AI agent/terminal the person happens to be using. Use when the user asks for a "posting schedule", "content calendar", "plan the week/month of content", or a "daily post reminder".
---

# Content calendar — editorial schedule + daily reminder

Cross-brand skill (not owned by any single brand) — reads `user/plugins/*/` and
`user/canva-killer/templates/*/` to build a real schedule grounded in what already exists, not
a generic "post every day at 9am" calendar.

## Flow

### 1. Discover what exists
- List `user/plugins/<brand>/` — each folder is a brand. Read each one's
  `.claude-plugin/plugin.json` to find its channels (skills), e.g. linkedin, instagram, blog,
  tiktok.
- For each channel, read its `SKILL.md` front-matter (`description`) to understand what kind of
  content that channel produces and in what tone.
- If the brand has visual templates under `user/canva-killer/templates/<brand>/*.html`, list
  their names — each file is a ready-made post type (e.g. produto, blog, vaga, evento,
  stories-*). That becomes the "type" field in the schedule; don't invent a type that has no
  matching channel or template.
- Read the brand's `voice-profile.json`, if it exists, to pull its editorial pillars — suggested
  themes should come from there, not from generic marketing ideas.

### 2. Ask what's missing (don't assume)
- Which brands go into this schedule (one, some, or every brand in `user/plugins/`)?
- Cadence per channel (e.g. LinkedIn 2x/week, Instagram feed 3x/week, Stories almost daily). If
  the user doesn't know, suggest a LOW starting cadence — easier to ramp up later than to
  abandon the whole schedule from overload — and confirm before applying it.
- Horizon: recommend 4 weeks (longer goes stale before it's followed; shorter turns into
  constant rework).
- Start date (default: next business day).

### 3. Generate the schedule
Write TWO files per brand into `user/plugins/<brand>/` (if the request spans several brands,
generate one pair of files per brand — never one mixed file):
- `schedule.md` — human-readable table: date, weekday, channel, type (template name when one
  exists), suggested theme, status (`tbd` / `ready`).
- `schedule.json` — same content as an array:
  `[{"date":"YYYY-MM-DD","brand":"...","channel":"...","type":"...","theme":"..."}]`. This is
  what the reminder script (`scripts/reminder.sh`) reads later — keep both files in sync
  whenever either one is edited.

Don't invent a theme outside the brand's `voice-profile.json` editorial pillars; if the brand
doesn't have clear pillars yet, ask the user for 3-5 recurring themes before filling in the
whole calendar — a schedule with a generic theme on every row is useless.

Note: `schedule.md`/`schedule.json` are the tool's own scaffolding (English, like the rest of
this skill), but the `theme`/copy content inside them can and should be written in whatever
language that brand's actual content is in (Portuguese for this repo's current PT-BR brands) —
same split as the rest of `marketing-tools` (generic tooling in English) vs. `user/plugins/`
(brand voice in the brand's own language).

### 4. Offer the daily reminder (system cron, agent-agnostic)
This lives at the OS level (`crontab`), not tied to whichever AI agent/terminal the person is
using that day — it fires even if Claude Code isn't running.

1. Confirm the reminder time (default 9am) and whether it's one reminder per brand or a
   consolidated one (passing several `schedule.json` files to the same script).
2. Run in preview mode first, without installing anything:
   ```bash
   bash plugins/marketing-tools/content-calendar/scripts/reminder.sh --dry-run user/plugins/<brand>/schedule.json
   ```
   Show the result to the user before going further.
3. Only after approval, install it for real:
   ```bash
   bash plugins/marketing-tools/content-calendar/scripts/install-cron.sh 09:00 user/plugins/<brand>/schedule.json
   ```
   The script is idempotent (refuses to duplicate if a marked line already exists), shows a
   preview of the resulting crontab, and asks for `y/N` confirmation before writing. **Always
   explicitly warn the user before running this** — it edits the system crontab, outside the
   repo; treat it like any other system-level change that needs confirmation.
4. The reminder itself (when fired by cron) notifies via `notify-send` (Linux) or `osascript`
   (macOS) and ALWAYS also appends to `~/.content-calendar-reminders.log` as a universal
   fallback — works even with no graphical session. That fallback is what makes the mechanism
   agent-agnostic: it doesn't require Claude Code, Cursor, or any specific CLI to be running at
   the moment it fires, just a standard system crontab.
5. Optionally, also wire the shell-startup hook — this is the one that actually surfaces
   *inside whatever terminal the person opens*, before they launch Claude Code, Codex, opencode,
   or anything else, which is what "agent-agnostic" means in practice (there's no shared bus
   that can push a message into an already-running TUI session from outside; a fresh terminal
   is the one thing every agent gets launched from). Preview first:
   ```bash
   bash plugins/marketing-tools/content-calendar/scripts/shell-greeting.sh user/plugins/<brand>/schedule.json
   ```
   Then, after explicit confirmation, wire it into the user's shell rc (`~/.bashrc` or
   `~/.zshrc`, auto-detected from `$SHELL`):
   ```bash
   bash plugins/marketing-tools/content-calendar/scripts/install-shell-hook.sh user/plugins/<brand>/schedule.json
   ```
   Same idempotent/preview/confirm discipline as `install-cron.sh` — it edits a personal dotfile,
   still a system-level change outside the repo. It only prints once per day (tracked via
   `~/.content-calendar-last-shown`), so opening several tabs doesn't repeat the same reminder.
6. Additionally, try to wire a native hook into whichever coding agent(s) the person actually
   has installed, so that agent can proactively bring up today's post instead of just printing
   text before it launches. Check what's present, per agent:
   - **Claude Code** — has a documented `SessionStart` hook (see the `update-config` skill for
     the full mechanics). Append (never replace) an entry to the `SessionStart` array in
     `.claude/settings.json` (project) or `~/.claude/settings.json` (user) running:
     ```bash
     bash plugins/marketing-tools/content-calendar/scripts/session-start-hook.sh user/plugins/<brand>/schedule.json
     ```
     It's silent (no output) when nothing is due today, and otherwise emits the standard
     `{"hookSpecificOutput":{"additionalContext":...}}` JSON so Claude actually knows and can
     mention it unprompted. Use the `update-config` skill to do the edit safely (read-merge-
     validate, never clobber existing hooks like `aag`'s).
   - **Codex, opencode, or anything else** — only wire an equivalent if you can find one
     *actually documented for the installed version* (check for a config/hooks file the tool
     itself reads, e.g. something under its own config directory). Don't guess at an
     undocumented mechanism or invent a config key that might silently no-op. If nothing
     verifiable exists, say so and rely on the shell-startup hook (step 5) and cron (step 3) for
     that agent — those two already cover it regardless of which CLI gets launched.
   This step is genuinely best-effort and agent-specific by nature — unlike steps 3-5, there is
   no way to make "the agent proactively mentions it" work without knowing that agent's own
   extension points.

## Keep it alive
A schedule is a living document, not a one-off task. When the user marks a post as published or
asks to reshuffle the week, update `schedule.md` AND `schedule.json` together, never just one of
them. When the horizon runs out (every date in the `.json` is in the past), tell the user and
offer to generate the next few weeks — don't let the reminder keep firing silently on an empty
schedule forever.

## See also
- Each brand's channels live in `user/plugins/<brand>/<channel>/SKILL.md` — that's where the
  actual post copy gets written; this skill only decides WHEN and WHAT, never the post itself.
- Visual post types come from `user/canva-killer/templates/<brand>/*.html` (see
  `canva-killer/skills/brand-identity/SKILL.md` for how those templates come to be).
