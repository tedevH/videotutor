/** Hand-drawn stroke geometry shared by the whiteboard diagram and frame annotations. */

export type Pt = [number, number];

/** Deterministic pseudo-random so a drawing looks the same on every render. */
export function rng(seed: number) {
  let s = Math.abs(Math.floor(seed * 9973)) % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647 - 0.5;
}

/** A slightly wobbly line, like a marker on a whiteboard. `unit` scales the wobble to the canvas size. */
export function roughSegment([x1, y1]: Pt, [x2, y2]: Pt, rand: () => number, move = true, unit = 1) {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const wobble = Math.min(0.9 * unit, len * 0.03);
  const nx = -(y2 - y1) / len;
  const ny = (x2 - x1) / len;
  const bend = rand() * wobble * 2;
  const cx = (x1 + x2) / 2 + nx * bend;
  const cy = (y1 + y2) / 2 + ny * bend;
  const j = () => rand() * 0.4 * unit;
  return `${move ? `M${x1 + j()},${y1 + j()}` : ""} Q${cx},${cy} ${x2 + j()},${y2 + j()}`;
}

export function roughEllipse(cx: number, cy: number, rx: number, ry: number, rand: () => number) {
  const n = 28;
  const start = rand() * Math.PI;
  const pts: string[] = [];
  for (let i = 0; i <= n + 2; i++) {
    const a = start + (i / n) * Math.PI * 2;
    const k = 1 + rand() * 0.05;
    pts.push(`${(cx + Math.cos(a) * rx * k).toFixed(2)},${(cy + Math.sin(a) * ry * k).toFixed(2)}`);
  }
  return `M${pts[0]} L${pts.slice(1).join(" ")}`;
}

export function roughRect(x0: number, y0: number, x1: number, y1: number, rand: () => number, unit = 1) {
  const corners: Pt[] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
  return corners.slice(1).map((p, k) => roughSegment(corners[k], p, rand, k === 0, unit)).join(" ");
}

/** Shaft and head paths for an arrow; `head` is the arrowhead length in canvas units. */
export function roughArrow(from: Pt, to: Pt, rand: () => number, head: number, unit = 1) {
  const ang = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const left: Pt = [to[0] - head * Math.cos(ang - 0.45), to[1] - head * Math.sin(ang - 0.45)];
  const right: Pt = [to[0] - head * Math.cos(ang + 0.45), to[1] - head * Math.sin(ang + 0.45)];
  return {
    shaft: roughSegment(from, to, rand, true, unit),
    head: `${roughSegment(left, to, rand, true, unit)} ${roughSegment(to, right, rand, false, unit)}`,
  };
}

export const INK: Record<string, string> = {
  ink: "#1c1b19",
  red: "#dc2626",
  blue: "#2563eb",
  green: "#16a34a",
  orange: "#ea580c",
  purple: "#7c3aed",
  yellow: "#facc15",
  white: "#ffffff",
};
