import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Rithvik Praveen Kumar — CS + Math @ Purdue";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: "80px 100px",
          background: "#08080e",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Accent bar at top */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: "#c2305e",
          }}
        />

        {/* Logo */}
        <div
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: "#c2305e",
            marginBottom: 48,
            letterSpacing: "-0.02em",
          }}
        >
          R.
        </div>

        {/* Name */}
        <div
          style={{
            fontSize: 88,
            fontWeight: 800,
            color: "#eeeef6",
            lineHeight: 1.0,
            letterSpacing: "-0.04em",
            marginBottom: 28,
          }}
        >
          Rithvik
          <br />
          Praveen Kumar
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 28,
            color: "#82829a",
            fontWeight: 400,
            letterSpacing: "-0.01em",
          }}
        >
          CS + Math @ Purdue · Building AI &amp; full-stack
        </div>

        {/* URL */}
        <div
          style={{
            position: "absolute",
            bottom: 64,
            right: 100,
            fontSize: 22,
            color: "#c2305e",
            fontWeight: 600,
            letterSpacing: "-0.01em",
          }}
        >
          rithvik.ai
        </div>
      </div>
    ),
    { ...size }
  );
}
