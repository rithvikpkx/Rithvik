# Agent + recruiter upgrades (Nov 13, 2026)

Handoff checklist; each slice is committed and pushed to `dev` on its own.

- [x] A. Lower rate limits (voice live 3/IP, 30 global per hr; TTS 20/300; STT 300 global; chat 600 global) + prompt caching (stable rules+profile prefix, `prompt_cache_key`)
- [x] B. Floating windows: several open at once (chat, email, resume, case, play), movable + resizable; chat has a detach button; agent tools to open/move/resize windows
- [x] C. Recruiter mode (`/recruiter`): photo, GitHub/LinkedIn/Email, resume rendered inline, email form open, core content expanded, RAG open, light/dark toggle, "back to the full site" footer; hero button; agent tool `recruiter_mode`
- [x] D. Visitor memory (+ job posting): remember name/email/company/role per visitor (cookie visitor id), greet returning visitors by name; agent asks gently for an introduction (honest that it's passed to Rithvik)
- [x] E. Code-grounded answers: tool that reads Rithvik's public GitHub repos (README + files) through the GitHub API
- [x] F. Theme-switch nudge on the main site (subtle)
- [x] Share links include voice turns (/api/voice/log, tagged "voice transcript")
- [x] Status bar: ready · N/M left · resets in Xm · tokens · ? for shortcuts
- [x] G. More creative chat-bar controls (voice mode / dictation / read-aloud / settings)
- [x] H. "RAG Cursor" mode: a labelled cursor that visibly clicks/types its actions
- [x] I. Feature roadmap with cost-benefit (below)

Owner sets the OpenAI spend limit on the dashboard.

## Roadmap: next upgrades, by value per dollar

Costs at ~300 chat turns, 20 voice chats a month (today's scale); "≈$0" = engineering only.

| # | Feature | Running cost | Why it pays |
|---|---|---|---|
| 1 | Lead alerts: email Rithvik the moment a visitor identifies as a recruiter or shares a job posting (Resend, already set up) | ≈$0 | turns a visit into a same-day reply |
| 2 | Fit report: when a recruiter shares a posting, a cited html artifact mapping each requirement to his projects + a tailored intro draft | ~$0.01 per report (route to gpt-6.1-terra) | the strongest recruiter conversion moment |
| 3 | Follow-up drafts in the dashboard: one-click personalised outreach email per identified visitor, from their chat | ~$0.005 each | outreach in seconds, not minutes |
| 4 | Weekly digest email: who visited, who identified, postings, best questions | ~$0.05/week (gpt-5-nano) | nothing slips through |
| 5 | Golden eval on every push (evals/agent.jsonl in CI) | ~$0.05/run | protects answer quality as prompts grow |
| 6 | Guided tour: "give me the 60-second tour" plays cursor mode through the site with narration | ~$0.02 per tour (TTS) | the agentic showcase, on rails |
| 7 | Auto "now building" from recent GitHub commits, summarised weekly | ~$0.01/week | the site stays fresh without edits |
| 8 | Answer in the visitor's language | ≈$0 | international recruiters |
| 9 | Theme and CTA experiments read from tracking (which nudge gets switches) | ≈$0 | data-driven polish |
| 10 | Owner's own voice (cloned) | ~$5–22/mo plan + per minute (ElevenLabs) or OpenAI sales | memorable, but high upkeep: past the point of diminishing returns |
