import type { Metadata } from "next";
import Link from "next/link";
import "@/components/agent-log/log.css";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What rithvik.ai collects about visitors, why, for how long, and how to ask for deletion.",
  alternates: { canonical: "/privacy" },
};

/** /privacy: the plain-language notice for visitor tracking, session recordings and the chat agent (linked from the site footer). */
export default function Privacy() {
  return (
    <main className="alog">
      <div className="alog-narrow">
        <h1>Privacy</h1>
        <p className="alog-muted">
          rithvik.ai is a personal site run by one person. It records how it is used, in detail, to learn who visits and to follow up.
          There is no cookie banner because there is nothing to opt into; this page is the whole disclosure.
        </p>

        <h2>What is collected</h2>
        <ul>
          <li><b>Your IP address</b>, stored as is, and the coarse location (country, region, city) your connection implies.</li>
          <li><b>A visitor cookie</b> (<code>rv_id</code>, a random id, first-party, kept for one year) that recognises your browser on later visits.</li>
          <li><b>Your device and browser</b>: browser and version, operating system, device type, screen size, language and time zone.</li>
          <li><b>Where you came from</b>: the referring page and any campaign tags in the link you followed.</li>
          <li><b>The company or network behind your IP address</b>, looked up from a public IP database (ipinfo.io). Your IP address is sent to that service for the lookup. It describes the network, such as an employer or university, not you personally.</li>
          <li><b>What you do on the site</b>: pages and sections you view, links and buttons you click, how far you scroll, how long you are active, which design you pick, windows you open (project pages, resume, the agent, the email composer), JavaScript errors, and page-speed measurements.</li>
          <li>
            <b>Full session recordings.</b> The site records a replayable video-like log of your visit: what is on screen, your mouse movement, clicks and scrolling,
            and <b>everything you type into forms and the chat, as you type it</b>, including text you do not send. The only fields never recorded are the owner&rsquo;s admin login boxes.
          </li>
          <li><b>Agent conversations</b>: your messages, the agent&rsquo;s replies, and which tools and sources it used. They are linked to your visitor record.</li>
          <li><b>Details you give</b>: if you send an email through the composer or a meeting request, the name, email, company, message and times you enter. Your email address is then attached to your visitor record, so earlier and later visits from this browser are tied to it.</li>
        </ul>

        <h2>Why</h2>
        <p>To understand who visits and what interests them, to fix problems, to improve the agent&rsquo;s answers, and to follow up with people who get in touch. Nothing is sold, shared with advertisers, or used to build a profile outside this site.</p>

        <h2>Who sees it</h2>
        <p>
          Only Rithvik can read the stored data. It lives in a private database and private file storage; the site&rsquo;s hosting and database providers
          (Vercel and Supabase) process it on his behalf. A conversation is shared only if you create a share link from the chat; that link works for 30 days
          and hides emails and phone numbers.
        </p>

        <h2>How long</h2>
        <ul>
          <li>Visits, clicks and other events: 400 days.</li>
          <li>Session recordings: 90 days.</li>
          <li>Agent conversations: 180 days after the last message.</li>
          <li>The visitor cookie: one year, renewed on each visit. Clear your cookies to become a new visitor.</li>
          <li>Anonymous counts for the public status page (response times, token counts, errors; no message text): 400 days.</li>
        </ul>

        <h2>Your choices</h2>
        <p>
          You can block the cookie or clear it in your browser, and a tracker-blocking extension will stop most of this. To have your data deleted, email{" "}
          <a href="mailto:rithvikpkx@gmail.com">rithvikpkx@gmail.com</a> with the approximate time of your visit and, if you have it, the IP address you were
          using or the email you gave, and everything tied to it will be removed.
        </p>

        <p><Link href="/">Back to rithvik.ai</Link></p>
      </div>
    </main>
  );
}
