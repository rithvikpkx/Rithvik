// Easter-egg link to the bare /buffett page. Sits near the theme dial.
export default function BuffettLink() {
  return (
    // Plain <a> is intentional: /buffett is a separate root layout, so
    // next/link's client-side navigation would skip its layout bootstrap.
    // The @next/next/no-html-link-for-pages rule does not fire here because
    // /buffett is an App Router route, not a pages/ file.
    <a
      className="buffett-link"
      href="/buffett"
      aria-describedby="buffett-tip"
      aria-label="For Warren Buffett — a plain HTML version of this site"
    >
      For Warren Buffett
      <span id="buffett-tip" className="buffett-tip" role="tooltip">
        Inspired by the official berkshire hathaway website
      </span>
    </a>
  );
}
