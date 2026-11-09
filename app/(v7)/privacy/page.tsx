import type { Metadata } from "next";
import Link from "next/link";
import "@/components/agent-log/log.css";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What the rithvik.ai agent stores, why, for how long, and how to ask for deletion.",
  alternates: { canonical: "/privacy" },
};

/** /privacy: the plain-language notice for the chat agent's logging (linked from the site footer). */
export default function Privacy() {
  return (
    <main className="alog">
      <div className="alog-narrow">
        <h1>Privacy</h1>
        <p className="alog-muted">How the chat agent on rithvik.ai handles what you type. The rest of the site stores nothing about you.</p>

        <h2>What is stored</h2>
        <ul>
          <li>Your messages and the agent&rsquo;s replies, including which tools it used and which sources it cited.</li>
          <li>Coarse location (country, region, city) from your connection, and your browser name and version.</li>
          <li>The page you came from, and which design of the site you were viewing.</li>
          <li>A one-way hash of your IP address, never the address itself. It is salted, so it cannot be turned back into the address.</li>
          <li>If you send a meeting request: the name, email, company and times you give.</li>
          <li>Anonymous counts only (response times, token counts, errors) feed a public status page. They hold no message text.</li>
        </ul>

        <h2>Why</h2>
        <p>To make the answers better, to fix problems, and to follow up if you ask to talk with Rithvik. Nothing is sold or used for advertising.</p>

        <h2>How long</h2>
        <p>Conversations are deleted 180 days after their last message. Anonymous status counts are kept for 400 days.</p>

        <h2>Sharing</h2>
        <p>
          Only Rithvik can read stored conversations. A conversation is shared only if you create a share link from the chat.
          The link works for 30 days, shows the conversation as it stands when opened, and hides emails and phone numbers.
        </p>

        <h2>Deletion</h2>
        <p>
          To have a conversation deleted, email <a href="mailto:rithvikpkx@gmail.com">rithvikpkx@gmail.com</a> with the
          approximate time you chatted, or the share link if you made one.
        </p>

        <p><Link href="/">Back to rithvik.ai</Link></p>
      </div>
    </main>
  );
}
