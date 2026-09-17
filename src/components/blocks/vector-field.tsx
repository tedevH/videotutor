"use client";

import { useMemo } from "react";
import { compileExpr } from "@/lib/math-eval";

const SIZE = 320;
const GRID = 15;

/** A 2D vector field drawn from its formula, with an optional parametric curve through it. */
export function VectorField({
  title,
  fx,
  fy,
  xDomain,
  yDomain,
  curve,
}: {
  title: string;
  fx: string;
  fy: string;
  xDomain: [number, number];
  yDomain: [number, number];
  curve: { x: string; y: string; t: [number, number] } | null;
}) {
  const drawn = useMemo(() => {
    const Fx = compileExpr(fx, ["x", "y"]);
    const Fy = compileExpr(fy, ["x", "y"]);
    if (!Fx || !Fy) return null;
    const [x0, x1] = xDomain;
    const [y0, y1] = yDomain;
    const sx = (x: number) => ((x - x0) / (x1 - x0)) * SIZE;
    const sy = (y: number) => SIZE - ((y - y0) / (y1 - y0)) * SIZE;

    const samples: { x: number; y: number; vx: number; vy: number }[] = [];
    for (let i = 0; i < GRID; i++) {
      for (let j = 0; j < GRID; j++) {
        const x = x0 + ((i + 0.5) / GRID) * (x1 - x0);
        const y = y0 + ((j + 0.5) / GRID) * (y1 - y0);
        const vx = Fx(x, y);
        const vy = Fy(x, y);
        if (Number.isFinite(vx) && Number.isFinite(vy)) samples.push({ x, y, vx, vy });
      }
    }
    const maxLen = Math.max(1e-9, ...samples.map((s) => Math.hypot(s.vx, s.vy)));
    const cell = SIZE / GRID;
    const arrows = samples.map((s) => {
      const mag = Math.hypot(s.vx, s.vy) / maxLen;
      const len = cell * 0.8 * Math.max(0.25, Math.sqrt(mag));
      const ang = Math.atan2(-s.vy, s.vx); // screen y points down
      const cx = sx(s.x);
      const cy = sy(s.y);
      const hx = cx + (Math.cos(ang) * len) / 2;
      const hy = cy + (Math.sin(ang) * len) / 2;
      const tx = cx - (Math.cos(ang) * len) / 2;
      const ty = cy - (Math.sin(ang) * len) / 2;
      // Rounded so server and client render identical path strings.
      const r = (n: number) => n.toFixed(2);
      const head = `M${r(hx)},${r(hy)} L${r(hx - Math.cos(ang - 0.5) * 5)},${r(hy - Math.sin(ang - 0.5) * 5)} M${r(hx)},${r(hy)} L${r(hx - Math.cos(ang + 0.5) * 5)},${r(hy - Math.sin(ang + 0.5) * 5)}`;
      return { d: `M${r(tx)},${r(ty)} L${r(hx)},${r(hy)} ${head}`, opacity: Number((0.35 + 0.65 * mag).toFixed(3)) };
    });

    let curvePath: string | null = null;
    if (curve) {
      const cx = compileExpr(curve.x, ["t"]);
      const cy = compileExpr(curve.y, ["t"]);
      if (cx && cy) {
        const pts = Array.from({ length: 121 }, (_, k) => {
          const t = curve.t[0] + ((curve.t[1] - curve.t[0]) * k) / 120;
          return [sx(cx(t)), sy(cy(t))];
        }).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
        curvePath = pts.map(([a, b], k) => `${k ? "L" : "M"}${a.toFixed(1)},${b.toFixed(1)}`).join(" ");
      }
    }
    return { arrows, curvePath, axisX: sy(0), axisY: sx(0) };
  }, [fx, fy, xDomain, yDomain, curve]);

  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-white">
      {title && <figcaption className="border-b border-line px-3 py-2 text-sm font-semibold">{title}</figcaption>}
      {drawn ? (
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto block w-full max-w-[420px]" role="img" aria-label={`Vector field F = (${fx}, ${fy})`}>
          <line x1="0" y1={drawn.axisX} x2={SIZE} y2={drawn.axisX} stroke="#1c1b19" strokeOpacity="0.3" />
          <line x1={drawn.axisY} y1="0" x2={drawn.axisY} y2={SIZE} stroke="#1c1b19" strokeOpacity="0.3" />
          {drawn.arrows.map((a, i) => (
            <path key={i} d={a.d} stroke="#2563eb" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity={a.opacity} />
          ))}
          {drawn.curvePath && <path d={drawn.curvePath} stroke="#d9480f" strokeWidth="3" fill="none" strokeLinecap="round" />}
        </svg>
      ) : (
        <p className="p-3 text-sm text-muted">Couldn&apos;t read this field.</p>
      )}
      <p className="border-t border-line px-3 py-2 text-xs text-muted">
        F(x, y) = ({fx}, {fy}){curve ? ` · orange: curve (${curve.x}, ${curve.y})` : ""}
      </p>
    </figure>
  );
}
