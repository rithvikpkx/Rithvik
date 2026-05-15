import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS Home Screen icon. iOS rounds the corners and applies a subtle gloss
 *  automatically, so we render a flat full-bleed mark and let the OS handle
 *  framing. Same brand recipe as the browser favicon: accent "R." on bg. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#08080e",
          color: "#c2305e",
          fontFamily: "system-ui, sans-serif",
          fontWeight: 900,
          letterSpacing: "-0.04em",
          fontSize: 124,
          lineHeight: 1,
        }}
      >
        R.
      </div>
    ),
    { ...size },
  );
}
