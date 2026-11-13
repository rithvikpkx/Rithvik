# Agent + recruiter upgrades (Nov 13, 2026)

Handoff checklist; each slice is committed and pushed to `dev` on its own.

- [x] A. Lower rate limits (voice live 3/IP, 30 global per hr; TTS 20/300; STT 300 global; chat 600 global) + prompt caching (stable rules+profile prefix, `prompt_cache_key`)
- [x] B. Floating windows: several open at once (chat, email, resume, case, play), movable + resizable; chat has a detach button; agent tools to open/move/resize windows
- [x] C. Recruiter mode (`/recruiter`): photo, GitHub/LinkedIn/Email, resume rendered inline, email form open, core content expanded, RAG open, light/dark toggle, "back to the full site" footer; hero button; agent tool `recruiter_mode`
- [x] D. Visitor memory (+ job posting): remember name/email/company/role per visitor (cookie visitor id), greet returning visitors by name; agent asks gently for an introduction (honest that it's passed to Rithvik)
- [x] E. Code-grounded answers: tool that reads Rithvik's public GitHub repos (README + files) through the GitHub API
- [ ] F. Theme-switch nudge on the main site (subtle)
- [x] Share links include voice turns (/api/voice/log, tagged "voice transcript")
- [x] Status bar: ready · N/M left · resets in Xm · tokens · ? for shortcuts
- [ ] G. More creative chat-bar controls (voice mode / dictation / read-aloud / settings)
- [ ] H. "RAG Cursor" mode: a labelled cursor that visibly clicks/types its actions
- [ ] I. Feature roadmap with cost-benefit (for the owner)

Owner sets the OpenAI spend limit on the dashboard.
