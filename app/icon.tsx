import { ImageResponse } from "next/og";

export const runtime = "edge";
/** 96×96, NOT 64. Google only accepts a search-result favicon whose dimensions
 *  are a multiple of 48px — at 64 it silently discards the icon and shows the
 *  generic globe instead. 96 is the smallest multiple that still looks crisp on
 *  retina tabs. Don't "optimise" this back down. */
export const size = { width: 96, height: 96 };
export const contentType = "image/png";

/** Browser-tab favicon: bold "R." in the default-theme accent color on the
 *  default-theme bg, mirroring the "Rithvik." brand mark in the hero.
 *  Next.js cache-busts via build hash. */
export default function Icon() {
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
          borderRadius: 18,
          color: "#c2305e",
          fontFamily: "system-ui, sans-serif",
          fontWeight: 900,
          letterSpacing: "-0.04em",
          fontSize: 66,
          lineHeight: 1,
        }}
      >
        R.
      </div>
    ),
    { ...size },
  );
}
