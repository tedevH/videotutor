import { ImageResponse } from "next/og";

export const alt = "LumoTutor · AI tutor for your lectures and homework";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The link preview: the product's own paper-and-ink look, nothing generic. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#fbfaf7",
          backgroundImage: "linear-gradient(#1c1b1910 1px, transparent 1px), linear-gradient(90deg, #1c1b1910 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          padding: 72,
          color: "#1c1b19",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34, fontWeight: 600 }}>LumoTutor</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 600, letterSpacing: -2, lineHeight: 1.05, maxWidth: 900 }}>
            Stuck at 14:32? Pause and just ask.
          </div>
          <div style={{ fontSize: 34, color: "#1c1b19aa", maxWidth: 860, lineHeight: 1.3 }}>
            Lumo watches the lecture with you, reads your homework, and draws the explanation on the exact moment you&apos;re stuck.
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, fontSize: 26 }}>
          {["Lectures", "Homework", "Whiteboard", "Practice"].map((tag) => (
            <div key={tag} style={{ display: "flex", border: "2px solid #1c1b19", borderRadius: 999, padding: "8px 22px", background: "#fff" }}>
              {tag}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
