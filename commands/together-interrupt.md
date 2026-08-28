---
description: Interrupt a friend's running Claude session with an urgent message (Claude Together)
argument-hint: <room> <message>
---

Send a message with the claude-together MCP server's send_message tool with priority "interrupt". The first word of "$ARGUMENTS" is the room name and the rest is the message — but if the first word doesn't match any room in `status`, and I'm only in one room, send the whole text there instead. This barges into the recipients' running sessions mid-turn, so it's for urgent things ("stop, I'm pushing a fix for that"), not chit-chat.
