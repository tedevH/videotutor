import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon: the same L-and-spark mark as the favicon, drawn at iOS size. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#1c1b19", position: "relative" }}>
        <div style={{ position: "absolute", left: 51, top: 37, width: 28, height: 104, borderRadius: 5, background: "#fbfaf7" }} />
        <div style={{ position: "absolute", left: 51, top: 113, width: 79, height: 28, borderRadius: 5, background: "#fbfaf7" }} />
        <div style={{ position: "absolute", left: 107, top: 36, width: 40, height: 40, borderRadius: 999, background: "#d9480f" }} />
      </div>
    ),
    size,
  );
}
