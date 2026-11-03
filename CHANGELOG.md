# Changelog

## 0.0.3

- A planner file that cannot be read for a moment, for example because of permissions, is no longer moved aside as if it were damaged.
- A hand-edited setting with the wrong kind of value no longer hangs the app on launch.
- Move overdue to today with nothing overdue no longer adds a step to undo.
- New token now takes effect at once, even while the Claude Code server is still starting.
- A second copy of Tideloop now quits without touching your planner file.
- The window refuses redirects and permission requests such as camera or location.

## 0.0.2

- An interactive tutorial on first run, using your own first todo. You can replay it from Settings.
- New todo now tells you when something went on the calendar instead of a list, and offers Undo.

## 0.0.1

First release.

- Week view with a tide chart that shows how full each day is and moves as you plan.
- Todo lists, with drag between lists and days, and full keyboard control.
- Month view for the longer look ahead.
- Quick add that understands text like "Dentist fri 14:30 45m".
- Six themes, with a separate pick for system light and dark.
- Automatic updates.
- An optional MCP server, so Claude Code can read and edit your planner.
