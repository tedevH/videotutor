"use client";

import { useEffect, useId, useMemo, useState } from "react";

type Matrix = [[number, number], [number, number]];

const SIZE = 320;
const SPAN = 4.5; // grid units visible from the center to each edge
const S = SIZE / 2 / SPAN;
const px = (x: number) => SIZE / 2 + x * S;
const py = (y: number) => SIZE / 2 - y * S;

/**
 * The plane under a 2x2 matrix: the grid morphs from the identity to A. Eigen-directions are
 * computed here from the matrix, so the picture is exact no matter what the model says.
 */
export function Transform2D({
  title,
  matrix,
  vectors,
  showEigenvectors,
}: {
  title: string;
  matrix: Matrix;
  vectors: { x: number; y: number; label: string }[];
  showEigenvectors: boolean;
}) {
  const clipId = `t2d-${useId().replace(/:/g, "")}`;
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 1800);
      setT(0.5 - 0.5 * Math.cos(Math.PI * p));
      if (p < 1) frame = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const [[a, b], [c, d]] = matrix;
  const M = (x: number, y: number): [number, number] => {
    const m11 = 1 + t * (a - 1);
    const m12 = t * b;
    const m21 = t * c;
    const m22 = 1 + t * (d - 1);
    return [m11 * x + m12 * y, m21 * x + m22 * y];
  };

  const eig = useMemo(() => eigen2(matrix), [matrix]);
  const det = a * d - b * c;

  const gridLines = [];
  for (let k = -6; k <= 6; k++) {
    const [x1, y1] = M(k, -6);
    const [x2, y2] = M(k, 6);
    const [x3, y3] = M(-6, k);
    const [x4, y4] = M(6, k);
    const axis = k === 0;
    gridLines.push(
      <line key={`v${k}`} x1={px(x1)} y1={py(y1)} x2={px(x2)} y2={py(y2)} stroke={axis ? "#1c1b19" : "#2563eb"} strokeOpacity={axis ? 0.55 : 0.22} strokeWidth={axis ? 1.5 : 1} />,
      <line key={`h${k}`} x1={px(x3)} y1={py(y3)} x2={px(x4)} y2={py(y4)} stroke={axis ? "#1c1b19" : "#2563eb"} strokeOpacity={axis ? 0.55 : 0.22} strokeWidth={axis ? 1.5 : 1} />,
    );
  }

  const arrow = (x: number, y: number, color: string, key: string, label?: string) => {
    const [tx, ty] = M(x, y);
    const len = Math.hypot(tx, ty);
    if (len < 1e-6) return <circle key={key} cx={px(0)} cy={py(0)} r="4" fill={color} />;
    const ux = tx / len;
    const uy = ty / len;
    const hx = px(tx);
    const hy = py(ty);
    const back = 9;
    return (
      <g key={key}>
        <line x1={px(0)} y1={py(0)} x2={hx - ux * back * 0.6} y2={hy + uy * back * 0.6} stroke={color} strokeWidth="3" strokeLinecap="round" />
        <path d={`M${hx},${hy} L${hx - ux * back - uy * 5},${hy + uy * back - ux * 5} L${hx - ux * back + uy * 5},${hy + uy * back + ux * 5}Z`} fill={color} />
        {label && (
          <text x={hx + ux * 12} y={hy - uy * 12 + 4} fontSize="13" fontWeight="600" fill={color} textAnchor="middle" stroke="white" strokeWidth="3" paintOrder="stroke">
            {label}
          </text>
        )}
      </g>
    );
  };

  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-white">
      {title && <figcaption className="border-b border-line px-3 py-2 text-sm font-semibold">{title}</figcaption>}
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto block w-full max-w-[420px]" role="img" aria-label={`The plane transformed by the matrix [[${a}, ${b}], [${c}, ${d}]]`}>
        <defs>
          <clipPath id={clipId}>
            <rect width={SIZE} height={SIZE} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          {gridLines}
          {showEigenvectors &&
            eig.map((e, i) => (
              <line
                key={`e${i}`}
                x1={px(-SPAN * 2 * e.v[0])}
                y1={py(-SPAN * 2 * e.v[1])}
                x2={px(SPAN * 2 * e.v[0])}
                y2={py(SPAN * 2 * e.v[1])}
                stroke="#16a34a"
                strokeWidth="2.5"
                strokeDasharray="7 5"
                opacity={0.35 + 0.65 * t}
              />
            ))}
          {arrow(1, 0, "#d9480f", "i", "î")}
          {arrow(0, 1, "#7c3aed", "j", "ĵ")}
          {vectors.map((v, i) => arrow(v.x, v.y, "#1c1b19", `v${i}`, v.label))}
        </g>
      </svg>
      <div className="space-y-2 border-t border-line px-3 py-2.5 text-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setT(0);
              setPlaying(true);
            }}
            className="rounded-full bg-foreground px-3 py-1 text-xs font-medium text-white"
          >
            ▶ Apply A
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={t}
            onChange={(e) => {
              setPlaying(false);
              setT(Number(e.target.value));
            }}
            className="flex-1 accent-[#d9480f]"
            aria-label="Blend from identity to A"
          />
        </div>
        <p className="text-xs text-muted">
          A = [[{a}, {b}], [{c}, {d}]] · det = {fmt(det)}
          {showEigenvectors &&
            (eig.length
              ? ` · green: eigen-directions (λ = ${[...new Set(eig.map((e) => fmt(e.lambda)))].join(", ")})`
              : " · no real eigenvectors (complex eigenvalues)")}
        </p>
      </div>
    </figure>
  );
}

const fmt = (n: number) => (Math.abs(n - Math.round(n)) < 1e-9 ? String(Math.round(n)) : n.toFixed(3).replace(/0+$/, ""));

/** Real eigenpairs of a 2x2 matrix, with unit eigenvectors; one per independent direction. */
function eigen2([[a, b], [c, d]]: Matrix): { lambda: number; v: [number, number] }[] {
  const tr = a + d;
  const disc = tr * tr - 4 * (a * d - b * c);
  if (disc < -1e-12) return [];
  const root = Math.sqrt(Math.max(0, disc));
  const lambdas = disc < 1e-12 ? [tr / 2] : [(tr + root) / 2, (tr - root) / 2];
  const pairs: { lambda: number; v: [number, number] }[] = [];
  for (const l of lambdas) {
    // Null space of (A - λI): rows (a-λ, b) and (c, d-λ)
    const r1: [number, number] = [a - l, b];
    const r2: [number, number] = [c, d - l];
    const row = Math.hypot(...r1) > Math.hypot(...r2) ? r1 : r2;
    if (Math.hypot(...row) < 1e-9) {
      // A = λI: every direction is an eigenvector; show the axes.
      pairs.push({ lambda: l, v: [1, 0] }, { lambda: l, v: [0, 1] });
      continue;
    }
    const v: [number, number] = [-row[1], row[0]];
    const n = Math.hypot(...v);
    pairs.push({ lambda: l, v: [v[0] / n, v[1] / n] });
  }
  return pairs;
}
