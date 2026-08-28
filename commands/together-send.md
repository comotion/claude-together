---
description: Send a message to a multiplayer room (Claude Together)
argument-hint: <room> <message>
---

Send a message with the claude-together MCP server's send_message tool with priority "normal" (it will reach the recipients' Claude sessions when their current turn finishes — use /together-interrupt for urgent barge-ins, or priority "passive" if I say it's non-urgent inbox mail). The first word of "$ARGUMENTS" is the room name and the rest is the message — but if the first word doesn't match any room in `status`, and I'm only in one room, send the whole text there instead. Confirm whether it was delivered live or queued for later.
