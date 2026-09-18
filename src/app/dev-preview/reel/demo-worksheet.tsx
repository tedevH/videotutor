import { MarkdownBlock } from "@/components/blocks/markdown-block";

/** A problem set page with a student's handwritten attempt, used by the demo reel. Fixed 1000 x 1294 (US letter). */
export const WORKSHEET_W = 1000;
export const WORKSHEET_H = 1294;

const PROBLEMS = [
  { n: "1", text: "Differentiate $f(x) = \\sin(x^2)$ and simplify.", y: 250 },
  { n: "2", text: "Find all critical points of $g(x) = x^3 - 3x + 1$ and classify each one.", y: 560 },
  { n: "3", text: "Evaluate $\\displaystyle\\lim_{x \\to 0} \\frac{1 - \\cos x}{x^2}$.", y: 900 },
];

/** What the student wrote, in their own hand. Problem 1 forgets the chain rule. */
const HANDWRITING = [
  { x: 110, y: 330, text: "f'(x) = cos(x²)", size: 54 },
  { x: 110, y: 400, text: "done!", size: 40, rotate: -4 },
  { x: 110, y: 700, text: "g'(x) = 3x² − 3 = 0", size: 50 },
  { x: 110, y: 765, text: "x² = 1  →  x = ±1", size: 50 },
];

export function DemoWorksheet({ inkProgress = 1 }: { inkProgress?: number }) {
  const shown = Math.round(HANDWRITING.length * inkProgress);
  return (
    <div style={{ width: WORKSHEET_W, height: WORKSHEET_H, background: "#fff", position: "relative", fontFamily: "Georgia, 'Times New Roman', serif", color: "#1c1b19" }}>
      <div style={{ position: "absolute", left: 80, right: 80, top: 70, display: "flex", justifyContent: "space-between", borderBottom: "2px solid #1c1b19", paddingBottom: 14 }}>
        <div>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 0.5 }}>MATH 21A · Problem Set 4</div>
          <div style={{ fontSize: 20, marginTop: 6, color: "#555" }}>Derivatives and their applications · Due Friday</div>
        </div>
        <div style={{ fontSize: 22, alignSelf: "flex-end" }}>Name: ____________</div>
      </div>
      {PROBLEMS.map((p) => (
        <div key={p.n} style={{ position: "absolute", left: 80, right: 80, top: p.y, fontSize: 28, lineHeight: 1.4, display: "flex", gap: 14 }}>
          <span style={{ fontWeight: 700 }}>{p.n}.</span>
          <MarkdownBlock md={p.text} className="[&_p]:my-0" />
        </div>
      ))}
      {HANDWRITING.slice(0, shown).map((h) => (
        <div
          key={h.text}
          style={{
            position: "absolute",
            left: h.x,
            top: h.y,
            fontFamily: "var(--font-caveat), 'Bradley Hand', cursive",
            fontSize: h.size,
            color: "#1d4ed8",
            transform: `rotate(${h.rotate ?? -1}deg)`,
            whiteSpace: "nowrap",
          }}
        >
          {h.text}
        </div>
      ))}
    </div>
  );
}
