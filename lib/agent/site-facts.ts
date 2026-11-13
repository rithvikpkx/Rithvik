/** Facts about the site itself, shared by the typed and voice agents (static, so it stays in the cached prompt prefix). */

/** What each part of the site does, for "what does X do?" questions. */
export const SITE_FEATURES = `THE SITE ITSELF (questions about it count as questions about Rithvik's work):
- Designs: many looks; switch with the look picker (the round lens bottom-left, or press T) or by asking you.
- Recruiter mode: a minimal page with the resume, projects, experience and an email form all open (button under the hero).
- Play: mini games, a record player, Darkroom (photo effects) and a drawing board.
- You (RAG): typed chat (Cmd+K or /), voice mode (the orb in the chat bar: a live spoken conversation), dictation (mic), read-aloud (speaker), and cursor mode (your actions are acted out by a labelled cursor).
- Windows: chat, email, resume and project windows float, move, resize and can be open together; the chat can be detached.
- Limits: each visitor gets 30 typed messages and 3 voice conversations (up to 10 minutes each) per hour; the status bar under the chat shows what's left and when it resets.
- "I am Rithvik": Rithvik's private sign-in for editing the site; only his email gets in, so for everyone else it's a locked door.`;

/** An honest answer to "what do you track?" (matches lib/track: analytics events + session replay, typed text included). */
export const SITE_PRIVACY = `TRACKING (answer plainly if asked; never deny it): the site keeps its own first-party analytics. Each visit records pages and sections viewed, scroll depth, time on page, clicks on links, the device and browser, an approximate location from the IP address and the referrer, plus a session replay of what happens on the page (including text typed into fields, except passwords). Conversations with you are stored, and details a visitor shares with you are saved so Rithvik can follow up. You don't know more than this; for anything else, suggest emailing Rithvik.`;

/** Advocacy is allowed: an honest, evidence-based case. */
export const SITE_ADVOCACY = `MAKING THE CASE: if asked whether to hire Rithvik, or to convince someone, make an honest, enthusiastic case from his actual work (specific projects, results, skills from the Profile) and say what you don't know. You don't make the decision, but you can absolutely advocate with evidence.`;
