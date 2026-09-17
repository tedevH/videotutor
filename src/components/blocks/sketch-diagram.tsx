"use client";

import { useEffect, useMemo, useState } from "react";
import type { DiagramElement } from "@/lib/tutor/schema";

const W = 100;
const H = 60;
const STEP_MS = 2200;

const COLORS: Record<string, string> = {
  ink: "#1c1b19",
  red: "#dc2626",
  blue: "#2563eb",
  green: "#16a34a",
  orange: "#ea580c",
  purple: "#7c3aed",
};
const FONT = { sm: 3.6, md: 4.4, lg: 5.8 } as const;

type Pt = [number, number];

/** Deterministic pseudo-random so a diagram looks the same on every render. */
function rng(seed: number) {
  let s = Math.abs(Math.floor(seed * 9973)) % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647 - 0.5;
}

/** A slightly wobbly line, like a marker on a whiteboard. */
function roughSegment([x1, y1]: Pt, [x2, y2]: Pt, rand: () => number, move = true) {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const wobble = Math.min(0.9, len * 0.03);
  const nx = -(y2 - y1) / len;
  const ny = (x2 - x1) / len;
  const bend = rand() * wobble * 2;
  const cx = (x1 + x2) / 2 + nx * bend;
  const cy = (y1 + y2) / 2 + ny * bend;
  const j = () => rand() * 0.4;
  return `${move ? `M${x1 + j()},${y1 + j()}` : ""} Q${cx},${cy} ${x2 + j()},${y2 + j()}`;
}

function roughEllipse(cx: number, cy: number, rx: number, ry: number, rand: () => number) {
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

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const cx = (x: number) => clamp(x, 1, W - 1);
const cy = (y: number) => clamp(y, 1, H - 1);

type Label = { x: number; y: number; text: string; size: number; color: string; step: number };

/** Nudges labels that would collide so text stays readable even when the model's layout is sloppy. */
function separateLabels(labels: Label[]) {
  const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
  for (const l of labels) {
    const halfW = (l.text.length * l.size * 0.52) / 2;
    for (let tries = 0; tries < 8; tries++) {
      const box = { x0: l.x - halfW, x1: l.x + halfW, y0: l.y - l.size * 0.7, y1: l.y + l.size * 0.3 };
      const hit = placed.some((p) => box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0);
      if (!hit) {
        placed.push(box);
        break;
      }
      l.y += l.size * 1.1 * (tries % 2 ? -(tries + 1) : tries + 1);
    }
    l.x = clamp(l.x, halfW + 1, W - halfW - 1);
    l.y = clamp(l.y, l.size, H - 1);
  }
  return labels;
}

function build(elements: DiagramElement[]) {
  const strokes: { d: string; color: string; step: number; dashed?: boolean; width: number }[] = [];
  const labels: Label[] = [];

  elements.forEach((el, i) => {
    const rand = rng(i + 1 + elements.length * 0.37);
    const color = COLORS[el.color] ?? COLORS.ink;
    const step = el.step;
    switch (el.kind) {
      case "rect": {
        const [x0, y0, x1, y1] = [cx(el.x), cy(el.y), cx(el.x + el.w), cy(el.y + el.h)];
        const corners: Pt[] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
        const d = corners.slice(1).map((p, k) => roughSegment(corners[k], p, rand, k === 0)).join(" ");
        strokes.push({ d, color, step, width: 0.45 });
        if (el.label) labels.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 + 1.2, text: el.label, size: FONT.md, color, step });
        break;
      }
      case "ellipse":
        strokes.push({ d: roughEllipse(cx(el.cx), cy(el.cy), el.rx, el.ry, rand), color, step, width: 0.45 });
        if (el.label) labels.push({ x: el.cx, y: el.cy + 1.2, text: el.label, size: FONT.md, color, step });
        break;
      case "line": {
        const pts = el.points.map(([x, y]) => [cx(x), cy(y)] as Pt);
        const d = pts.slice(1).map((p, k) => roughSegment(pts[k], p, rand, k === 0)).join(" ");
        strokes.push({ d, color, step, dashed: el.dashed, width: 0.45 });
        break;
      }
      case "arrow": {
        const from: Pt = [cx(el.from[0]), cy(el.from[1])];
        const to: Pt = [cx(el.to[0]), cy(el.to[1])];
        const ang = Math.atan2(to[1] - from[1], to[0] - from[0]);
        const head = 2.4;
        const left: Pt = [to[0] - head * Math.cos(ang - 0.45), to[1] - head * Math.sin(ang - 0.45)];
        const right: Pt = [to[0] - head * Math.cos(ang + 0.45), to[1] - head * Math.sin(ang + 0.45)];
        strokes.push({ d: roughSegment(from, to, rand), color, step, dashed: el.dashed, width: 0.5 });
        strokes.push({ d: `${roughSegment(left, to, rand)} ${roughSegment(to, right, rand, false)}`, color, step, width: 0.5 });
        if (el.label) {
          const len = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
          const off = 3.2;
          labels.push({
            x: (from[0] + to[0]) / 2 + (-(to[1] - from[1]) / len) * off,
            y: (from[1] + to[1]) / 2 + ((to[0] - from[0]) / len) * off + 1,
            text: el.label,
            size: FONT.md,
            color,
            step,
          });
        }
        break;
      }
      case "text":
        labels.push({ x: el.x, y: el.y + 1, text: el.text, size: FONT[el.size], color, step });
        break;
      case "highlight":
        strokes.push({ d: roughEllipse(cx(el.cx), cy(el.cy), el.r * 1.15, el.r, rand), color, step, width: 0.6 });
        break;
    }
  });

  return { strokes, labels: separateLabels(labels) };
}

export function SketchDiagram({
  title,
  elements,
  steps,
}: {
  title: string;
  elements: DiagramElement[];
  steps: { step: number; narration: string }[];
}) {
  const { strokes, labels } = useMemo(() => build(elements), [elements]);
  const maxStep = Math.max(1, ...elements.map((e) => e.step), ...steps.map((s) => s.step));
  const [step, setStep] = useState(1);
  const [autoplay, setAutoplay] = useState(true);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (!autoplay || step >= maxStep) return;
    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [autoplay, step, maxStep]);

  const narration = steps.find((s) => s.step === step)?.narration;
  const visibleStrokes = strokes.filter((s) => s.step <= step);

  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-white">
      {title && <figcaption className="border-b border-line px-3 py-2 font-hand text-xl">{title}</figcaption>}
      <svg key={run} viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={title}>
        {visibleStrokes.map((s, i) => {
          const indexInStep = visibleStrokes.slice(0, i).filter((o) => o.step === s.step).length;
          return (
            <path
              key={`${s.step}-${strokes.indexOf(s)}`}
              d={s.d}
              pathLength={1}
              fill="none"
              stroke={s.color}
              strokeWidth={s.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={s.dashed ? "1.5 1.2" : undefined}
              className={s.dashed ? "sketch-fade" : "sketch-stroke"}
              style={{ ["--delay" as string]: `${indexInStep * 250}ms` }}
            />
          );
        })}
        {labels
          .filter((l) => l.step <= step)
          .map((l, i) => (
            <text
              key={`${l.step}-${i}-${l.text}`}
              x={l.x}
              y={l.y}
              fontSize={l.size}
              fill={l.color}
              textAnchor="middle"
              stroke="white"
              strokeWidth={0.8}
              paintOrder="stroke"
              className="sketch-fade font-hand"
              style={{ ["--delay" as string]: "450ms" }}
            >
              {l.text}
            </text>
          ))}
      </svg>
      <div className="flex items-center gap-2 border-t border-line px-3 py-2">
        <p className="min-h-[1.5rem] flex-1 text-sm text-muted">{narration}</p>
        <span className="text-xs tabular-nums text-muted">
          {step}/{maxStep}
        </span>
        <button
          aria-label="Previous step"
          disabled={step <= 1}
          onClick={() => {
            setAutoplay(false);
            setStep((s) => s - 1);
          }}
          className="rounded px-2 py-1 text-sm hover:bg-stone-100 disabled:opacity-30"
        >
          ◀
        </button>
        <button
          aria-label="Next step"
          disabled={step >= maxStep}
          onClick={() => {
            setAutoplay(false);
            setStep((s) => s + 1);
          }}
          className="rounded px-2 py-1 text-sm hover:bg-stone-100 disabled:opacity-30"
        >
          ▶
        </button>
        <button
          aria-label="Replay drawing"
          onClick={() => {
            setStep(1);
            setRun((r) => r + 1);
            setAutoplay(true);
          }}
          className="rounded px-2 py-1 text-sm hover:bg-stone-100"
        >
          ↺
        </button>
      </div>
    </figure>
  );
}
