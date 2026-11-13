# Dashboard inspiration (round 2, S2)

What the admin and /status dashboards borrow, and from where. References give feelings and single elements, never a
layout. The language itself is rithvik.ai's: the ouroboros mark, Geist + Geist Mono, the agent's TUI glyphs
(`❯` prompt, `⏺` tool, `✻` answer), the site's dark chrome (`#0f0f12`, pink `#ff4d8d`, amber `#ffd166`).

| # | Borrowed idea | From | What it solves here |
|---|---|---|---|
| 1 | **Trace waterfall**: one bar per step on a shared time axis, colour = step kind, fits one screen | Langfuse timeline / responsive timeline, Datadog LLM trace view | A chat turn stops being a row of numbers: you see where the time went (waiting for the first byte vs. streaming) and which turn was slow. |
| 2 | **Cost + tokens in the trace banner**, input/output split on hover | Datadog LLM Observability cost view | Per-conversation tokens and estimated cost sit on the conversation itself instead of a separate stats card. |
| 3 | **Every request as a dot on a log-latency axis** (strip/beeswarm), outliers visible instead of averaged away | Honeycomb log-scale heatmaps | p50/p95 tiles hide the shape. A dot per answer shows clusters, cache hits (fast), and the one 9-second outlier. |
| 4 | **Restraint**: a handful of numbers, one chart, a few panels; the live count at the top, refreshing on its own | Plausible, Fathom | The old overview had 8 KPI tiles and 20 cards. Now: four numbers, one idea per panel, and the page refreshes itself every minute. |
| 5 | **Activity timeline with event markers** you can scan and jump through | PostHog replay inspector (events on a synced timeline, skip inactivity) | Each visit becomes a track with glyphs at the moment things happened (opened a case, asked the agent, sent an email), so a visit reads at a glance before you open the replay. |
| 6 | **Sessions as a tree/strip of their requests** | Helicone sessions, LangSmith threads | The chats list shows each conversation's shape (questions, tool calls, answers, errors) as a strip of glyphs, not just its first question. |
| 7 | **Keyboard-first lists**: j/k to move, Enter to open, / to search | Linear | Long lists of chats and visitors are fast to triage without the mouse. |
| 8 | **Radial time-of-day**: a day as a ring | Clock-face / polar activity charts (Dribbble analytics concepts), Raycast/Arc-style single-object hero | The ouroboros is already a ring. The hours of the day wrap around it, so the hero shows *when* people come and carries the brand mark at the same time. |
| 9 | **Uptime as ticks**, failures taller as well as red | Status pages (Vercel, Atlassian Statuspage) | Kept from the old page: shape and colour both mark a failure. |
| 10 | **Instrument framing**: hairline panels with corner ticks on a faint dot grid | Grafana / oscilloscope UIs, Teenage Engineering product pages | Panels read as instruments on one surface, not SaaS cards; it matches the agent's terminal feel. |

Sources: [Langfuse timeline](https://langfuse.com/changelog/2024-06-12-timeline-view),
[Langfuse new trace view](https://langfuse.com/changelog/2025-03-19-new-trace-view),
[Langfuse responsive timeline](https://langfuse.com/changelog/2026-08-28-responsive-timeline),
[Datadog LLM cost](https://docs.datadoghq.com/llm_observability/monitoring/cost/),
[Honeycomb log-scale heatmaps](https://www.honeycomb.io/blog/handle-unruly-outliers-with-log-scale-heatmaps),
[Honeycomb heatmaps guide](https://docs.honeycomb.io/guides/heatmaps),
[Plausible guided tour](https://docs.plausible.io/guided-tour),
[PostHog: watching recordings](https://posthog.com/docs/session-replay/how-to-watch-recordings),
[Helicone sessions](https://docs.helicone.ai/features/sessions),
[Linear Insights](https://linear.app/docs/insights).

## Choice: one dark theme

The dashboards no longer follow the visitor's look. One dark theme, because: the site's own chrome tokens
(`app/(v7)/core.css`) and the agent window are dark, so the replicas and the TUI glyphs sit in their native
surface; colour-coded marks (pink = people, amber = agent, green/red = health) keep their contrast on dark; and an
observability screen is something you leave open.
