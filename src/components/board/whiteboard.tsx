"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { MarkdownBlock } from "@/components/blocks/markdown-block";
import { compileExpr } from "@/lib/math-eval";
import { INK, roughArrow, roughEllipse, roughRect, roughSegment, rng, type Pt } from "@/lib/sketch";
import type { BoardOp } from "@/lib/tutor/schema";

const W = 100;
const H = 60;
const STEP_MS = 2600;
const FONT = { sm: 2.6, md: 3.4, lg: 4.6 } as const;

type Box = { x: number; y: number; w: number; h: number };
type Stroke = { color: string; points: Pt[] };

const colorOf = (c: string) => INK[c] ?? INK.ink;

/** Rough size of an item, used for highlights and layout checks. */
function boxOf(op: BoardOp): Box | null {
  switch (op.op) {
    case "write": {
      const plain = op.text.replace(/\$|\\[a-zA-Z]+|[{}^_]/g, "");
      // Rendered math sits a little below the write point and is taller than plain text.
      return { x: op.x, y: op.y + FONT[op.size], w: Math.min(W - op.x, plain.length * FONT[op.size] * 0.6 + 2), h: FONT[op.size] * 1.8 };
    }
    case "draw": {
      const xs = op.points.map((p) => p[0]);
      const ys = op.points.map((p) => p[1]);
      return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    }
    case "graph":
      return { x: op.x, y: op.y, w: op.w, h: op.h };
    case "highlight":
      return op.w && op.h ? { x: op.x, y: op.y, w: op.w, h: op.h } : null;
    default:
      return null;
  }
}

/** Applies ops up to `step`: later erases remove earlier items. */
function visibleOps(ops: BoardOp[], step: number) {
  const shown = ops.filter((o) => o.step <= step);
  const erased = new Set(shown.flatMap((o) => (o.op === "erase" ? o.ids : [])));
  return shown.filter((o) => o.op !== "erase" && !(o.id && erased.has(o.id)));
}

function graphPaths(op: Extract<BoardOp, { op: "graph" }>) {
  const f = compileExpr(op.fn, ["x"]);
  if (!f) return null;
  const [x0, x1] = op.xDomain;
  const samples = Array.from({ length: 81 }, (_, i) => {
    const x = x0 + ((x1 - x0) * i) / 80;
    return [x, f(x)] as const;
  }).filter(([, y]) => Number.isFinite(y));
  if (!samples.length) return null;
  const ys = samples.map(([, y]) => y);
  const [y0, y1] = op.yDomain ?? [Math.min(0, ...ys), Math.max(0, ...ys)];
  const span = y1 - y0 || 1;
  const sx = (x: number) => op.x + ((x - x0) / (x1 - x0)) * op.w;
  const sy = (y: number) => op.y + op.h - ((Math.min(y1, Math.max(y0, y)) - y0) / span) * op.h;
  const curve = samples.map(([x, y], i) => `${i ? "L" : "M"}${sx(x).toFixed(2)},${sy(y).toFixed(2)}`).join(" ");
  let shade: string | null = null;
  if (op.shade) {
    const [a, b] = op.shade;
    const inside = samples.filter(([x]) => x >= a && x <= b);
    if (inside.length > 1) {
      shade = `M${sx(a)},${sy(0)} ${inside.map(([x, y]) => `L${sx(x).toFixed(2)},${sy(y).toFixed(2)}`).join(" ")} L${sx(b)},${sy(0)} Z`;
    }
  }
  const axisX = y0 <= 0 && y1 >= 0 ? sy(0) : op.y + op.h;
  const axisY = x0 <= 0 && x1 >= 0 ? sx(0) : op.x;
  // Marks use the same transform as the curve, so a vertex sits exactly on it.
  const marks = (op.marks ?? [])
    .filter((m) => m.x >= Math.min(x0, x1) && m.x <= Math.max(x0, x1) && m.y >= y0 && m.y <= y1)
    .map((m) => ({ cx: sx(m.x), cy: sy(m.y), label: m.label }));
  return { curve, shade, axisX, axisY, marks };
}

export function Whiteboard({
  title,
  ops,
  steps = [],
  allowDrawing = false,
  onAskAboutDrawing,
  captureRef,
  stepMs = STEP_MS,
}: {
  title?: string;
  ops: BoardOp[];
  steps?: { step: number; narration: string }[];
  allowDrawing?: boolean;
  onAskAboutDrawing?: (png: string) => void;
  /** Lets the page grab the current board (Lumo's work plus the student's strokes) to send with a question. */
  captureRef?: { current: (() => Promise<string | null>) | null };
  /** How long each step shows before the next one draws. */
  stepMs?: number;
}) {
  const maxStep = Math.max(1, ...ops.map((o) => o.step), ...steps.map((s) => s.step));
  const [step, setStep] = useState(1);
  // New ops arrive when Lumo adds to the board; replay them from the start without remounting,
  // so the student's own strokes stay exactly where they drew them.
  const [shownOps, setShownOps] = useState(ops);
  if (shownOps !== ops) {
    // Keep everything already on the board visible; only the newly added steps animate in.
    const drawn = Math.max(0, ...shownOps.map((o) => o.step));
    setShownOps(ops);
    setStep(ops.length > shownOps.length && drawn > 0 ? drawn : 1);
  }
  const [autoplay, setAutoplay] = useState(true);
  const [run, setRun] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [penColor, setPenColor] = useState("#1c1b19");
  const svgRef = useRef<SVGSVGElement>(null);
  // Highlights have to sit on the text KaTeX actually rendered, not on a character-count estimate.
  const writeEls = useRef(new Map<string, SVGForeignObjectElement>());
  const [measured, setMeasured] = useState<Record<string, Box>>({});
  const gridId = `board-grid-${useId().replace(/:/g, "")}`;
  const active = useRef<Stroke | null>(null);

  useEffect(() => {
    if (!autoplay || step >= maxStep) return;
    const t = setTimeout(() => setStep((s) => s + 1), stepMs);
    return () => clearTimeout(t);
  }, [autoplay, step, maxStep, stepMs]);

  const items = useMemo(() => visibleOps(ops, step), [ops, step]);
  // Grow the board downward if Lumo wrote past the bottom edge, rather than clipping the last lines.
  const height = useMemo(() => {
    const bottoms = ops.map((o) => {
      const b = boxOf(o);
      return b ? b.y + b.h : 0;
    });
    return Math.max(H, Math.ceil(Math.max(0, ...bottoms) + 3));
  }, [ops]);
  const byId = useMemo(() => new Map(ops.filter((o) => o.id).map((o) => [o.id, o])), [ops]);
  const narration = steps.find((s) => s.step === step)?.narration;

  const measuredRef = useRef<Record<string, Box>>({});
  useEffect(() => {
    const measure = () => {
      const svg = svgRef.current;
      const ctm = svg?.getScreenCTM();
      if (!svg || !ctm) return;
      const inverse = ctm.inverse();
      const next: Record<string, Box> = {};
      for (const [id, el] of writeEls.current) {
        const content = el.firstElementChild?.firstElementChild ?? el.firstElementChild;
        const r = content?.getBoundingClientRect();
        if (!r || !r.width || !r.height) continue;
        const a = new DOMPoint(r.left, r.top).matrixTransform(inverse);
        const b = new DOMPoint(r.right, r.bottom).matrixTransform(inverse);
        next[id] = { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
      }
      const old = measuredRef.current;
      const same =
        Object.keys(next).length === Object.keys(old).length &&
        Object.entries(next).every(([id, b]) => {
          const prev = old[id];
          return prev && Math.abs(prev.x - b.x) < 0.05 && Math.abs(prev.y - b.y) < 0.05 && Math.abs(prev.w - b.w) < 0.05 && Math.abs(prev.h - b.h) < 0.05;
        });
      if (same) return;
      measuredRef.current = next;
      setMeasured(next);
    };
    // Measure after fonts and KaTeX have laid out, and again whenever the board is resized.
    const raf = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    if (svgRef.current) observer.observe(svgRef.current);
    for (const el of writeEls.current.values()) observer.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [items]);

  useEffect(() => {
    if (!captureRef) return;
    // Only worth sending when the student has drawn something: Lumo already knows its own ops from <board_now>.
    captureRef.current = async () => (strokes.length === 0 ? null : exportPng());
    return () => {
      captureRef.current = null;
    };
  });

  const toBoard = (e: React.PointerEvent): Pt | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return [Number(p.x.toFixed(2)), Number(p.y.toFixed(2))];
  };

  async function exportPng() {
    const svg = buildExportSvg(items, strokes, byId, height, measuredRef.current);
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = Math.round((1200 * height) / W);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png").split(",")[1];
  }

  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-white">
      {title && <figcaption className="border-b border-line px-3 py-2 text-sm font-semibold">{title}</figcaption>}
      <svg
        key={run}
        ref={svgRef}
        viewBox={`0 0 ${W} ${height}`}
        className={`block w-full touch-none select-none ${drawing ? "cursor-crosshair" : ""}`}
        role="img"
        aria-label={title ?? "Whiteboard"}
        onPointerDown={(e) => {
          if (!drawing) return;
          const p = toBoard(e);
          if (!p) return;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          const stroke = { color: penColor, points: [p] };
          active.current = stroke;
          setStrokes((s) => [...s, stroke]);
        }}
        onPointerMove={(e) => {
          if (!drawing || !active.current) return;
          const p = toBoard(e);
          if (!p) return;
          // Snapshot now: the state update runs later, possibly after pointer-up clears the ref.
          const stroke = { color: active.current.color, points: [...active.current.points, p] };
          active.current = stroke;
          setStrokes((s) => [...s.slice(0, -1), stroke]);
        }}
        onPointerUp={() => {
          active.current = null;
        }}
        onPointerCancel={() => {
          active.current = null;
        }}
      >
        <defs>
          <pattern id={gridId} width="5" height="5" patternUnits="userSpaceOnUse">
            <path d="M5 0H0V5" fill="none" stroke="#1c1b19" strokeOpacity="0.05" strokeWidth="0.15" />
          </pattern>
        </defs>
        <rect width={W} height={height} fill={`url(#${gridId})`} />

        {items.map((o, i) => {
          const key = `${o.op}-${o.id || i}-${o.step}`;
          const rand = rng(i + 3.1);
          const color = colorOf("color" in o ? o.color : "ink");
          switch (o.op) {
            case "write":
              return (
                <foreignObject
                  key={key}
                  ref={(el) => {
                    if (!o.id) return;
                    if (el) writeEls.current.set(o.id, el);
                    else writeEls.current.delete(o.id);
                  }}
                  x={o.x}
                  y={o.y}
                  width={Math.max(10, W - o.x - 1)}
                  height={FONT[o.size] * 2.2}
                  className="sketch-fade overflow-visible"
                >
                  {/* Rendered 10x larger and scaled down: browsers round hairlines (fraction bars) up to 1px before scaling. */}
                  <div style={{ fontSize: FONT[o.size] * 10, lineHeight: 1.3, color, whiteSpace: "nowrap", width: "1000%", transform: "scale(0.1)", transformOrigin: "0 0" }}>
                    <MarkdownBlock md={o.text} className="[&_.katex-display]:my-0 [&_p]:my-0" />
                  </div>
                </foreignObject>
              );
            case "draw": {
              const pts = o.points as Pt[];
              let d = "";
              if (o.shape === "rect") d = roughRect(pts[0][0], pts[0][1], pts[1][0], pts[1][1], rand, 0.6);
              else if (o.shape === "ellipse") d = roughEllipse((pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2, Math.abs(pts[1][0] - pts[0][0]) / 2, Math.abs(pts[1][1] - pts[0][1]) / 2, rand);
              else if (o.shape === "arrow") {
                const { shaft, head } = roughArrow(pts[0], pts[pts.length - 1], rand, 2.2, 0.6);
                d = `${shaft} ${head}`;
              } else d = pts.slice(1).map((p, k) => roughSegment(pts[k], p, rand, k === 0, 0.6)).join(" ");
              const mid = pts[Math.floor(pts.length / 2)];
              return (
                <g key={key}>
                  <path d={d} pathLength={1} fill="none" stroke={color} strokeWidth={0.5} strokeLinecap="round" strokeDasharray={o.dashed ? "1.5 1.2" : undefined} className={o.dashed ? "sketch-fade" : "sketch-stroke"} />
                  {o.label && (
                    <text x={mid[0] + 1.5} y={mid[1] - 1.5} fontSize={2.8} fill={color} stroke="white" strokeWidth={0.6} paintOrder="stroke" className="sketch-fade">
                      {o.label}
                    </text>
                  )}
                </g>
              );
            }
            case "graph": {
              const g = graphPaths(o);
              if (!g) return null;
              return (
                <g key={key} className="sketch-fade">
                  {g.shade && <path d={g.shade} fill={color} opacity={0.18} />}
                  <line x1={o.x} y1={g.axisX} x2={o.x + o.w} y2={g.axisX} stroke="#1c1b19" strokeOpacity={0.45} strokeWidth={0.25} />
                  <line x1={g.axisY} y1={o.y} x2={g.axisY} y2={o.y + o.h} stroke="#1c1b19" strokeOpacity={0.45} strokeWidth={0.25} />
                  <path d={g.curve} fill="none" stroke={color} strokeWidth={0.55} pathLength={1} className="sketch-stroke" />
                  {g.marks.map((m, k) => (
                    <g key={k}>
                      <circle cx={m.cx} cy={m.cy} r={0.9} fill={colorOf("red")} />
                      {m.label && (
                        <text
                          x={m.cx + (m.cx > o.x + o.w * 0.6 ? -1.6 : 1.6)}
                          y={m.cy - 1.4}
                          textAnchor={m.cx > o.x + o.w * 0.6 ? "end" : "start"}
                          fontSize={2.6}
                          fill={colorOf("red")}
                          stroke="white"
                          strokeWidth={0.6}
                          paintOrder="stroke"
                        >
                          {m.label}
                        </text>
                      )}
                    </g>
                  ))}
                </g>
              );
            }
            case "highlight": {
              const target = o.target ? byId.get(o.target) : null;
              const box = (o.target && measured[o.target]) ?? (target && boxOf(target)) ?? boxOf(o);
              if (!box) return null;
              const pad = 1.5;
              return (
                <path
                  key={key}
                  d={roughEllipse(box.x + box.w / 2, box.y + box.h / 2, box.w / 2 + pad * 1.6, box.h / 2 + pad, rand)}
                  pathLength={1}
                  fill="none"
                  stroke={color}
                  strokeWidth={0.55}
                  className="sketch-stroke"
                />
              );
            }
            default:
              return null;
          }
        })}

        {strokes.map((s, i) => (
          <polyline key={`ink-${i}`} points={s.points.map((p) => p.join(",")).join(" ")} fill="none" stroke={s.color} strokeWidth={0.55} strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2">
        <div className="min-h-[1.5rem] flex-1 text-sm text-muted [&_p]:my-0">{narration && <MarkdownBlock md={narration} className="text-sm" />}</div>
        {maxStep > 1 && (
          <>
            <span className="text-xs tabular-nums text-muted">
              {step}/{maxStep}
            </span>
            <button aria-label="Previous step" disabled={step <= 1} onClick={() => { setAutoplay(false); setStep((s) => s - 1); }} className="rounded px-2 py-1 text-sm hover:bg-stone-100 disabled:opacity-30">
              ◀
            </button>
            <button aria-label="Next step" disabled={step >= maxStep} onClick={() => { setAutoplay(false); setStep((s) => s + 1); }} className="rounded px-2 py-1 text-sm hover:bg-stone-100 disabled:opacity-30">
              ▶
            </button>
            <button aria-label="Replay" onClick={() => { setStep(1); setRun((r) => r + 1); setAutoplay(true); }} className="rounded px-2 py-1 text-sm hover:bg-stone-100">
              ↺
            </button>
          </>
        )}
      </div>

      {allowDrawing && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-stone-50 px-3 py-2 text-sm">
          <button
            onClick={() => {
              setDrawing((d) => !d);
              setAutoplay(false);
              setStep(maxStep);
            }}
            className={`rounded-full px-3 py-1 font-medium ${drawing ? "bg-ink text-white" : "border border-line bg-white"}`}
          >
            ✏️ {drawing ? "Drawing" : "Draw on the board"}
          </button>
          {drawing && (
            <>
              {["#1c1b19", "#dc2626", "#2563eb"].map((c) => (
                <button key={c} aria-label="Pen color" onClick={() => setPenColor(c)} className={`h-5 w-5 rounded-full border-2 ${penColor === c ? "border-ink" : "border-white"}`} style={{ background: c }} />
              ))}
              <button onClick={() => setStrokes((s) => s.slice(0, -1))} disabled={!strokes.length} className="rounded px-2 py-1 text-muted hover:text-ink disabled:opacity-40">
                Undo
              </button>
              <button onClick={() => setStrokes([])} disabled={!strokes.length} className="rounded px-2 py-1 text-muted hover:text-ink disabled:opacity-40">
                Clear
              </button>
            </>
          )}
          <span className="flex-1" />
          {onAskAboutDrawing && strokes.length > 0 && (
            <button onClick={async () => onAskAboutDrawing(await exportPng())} className="rounded-full bg-pen px-3 py-1 font-medium text-white">
              Ask Lumo about my drawing
            </button>
          )}
        </div>
      )}
    </figure>
  );
}

/** Plain SVG (no HTML) of the board and the student's ink, so it rasterizes reliably for the tutor. */
function buildExportSvg(items: BoardOp[], strokes: Stroke[], byId: Map<string, BoardOp>, height: number, measured: Record<string, Box> = {}) {
  const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);
  const parts: string[] = [];
  for (const o of items) {
    const color = colorOf("color" in o ? o.color : "ink");
    if (o.op === "write") {
      parts.push(`<text x="${o.x}" y="${o.y + FONT[o.size]}" font-size="${FONT[o.size]}" font-family="sans-serif" fill="${color}">${esc(o.text.replace(/\$/g, ""))}</text>`);
    } else if (o.op === "draw") {
      parts.push(`<polyline points="${o.points.map((p) => p.join(",")).join(" ")}" fill="none" stroke="${color}" stroke-width="0.5"/>`);
    } else if (o.op === "graph") {
      const g = graphPaths(o);
      if (g) {
        parts.push(`<path d="${g.curve}" fill="none" stroke="${color}" stroke-width="0.5"/>`);
        for (const m of g.marks) {
          parts.push(`<circle cx="${m.cx}" cy="${m.cy}" r="0.9" fill="${colorOf("red")}"/>`);
          if (m.label) parts.push(`<text x="${m.cx + 1.6}" y="${m.cy - 1.4}" font-size="2.6" fill="${colorOf("red")}">${esc(m.label)}</text>`);
        }
      }
    } else if (o.op === "highlight") {
      const t = o.target ? byId.get(o.target) : null;
      const b = (o.target && measured[o.target]) ?? (t && boxOf(t)) ?? boxOf(o);
      if (b) parts.push(`<ellipse cx="${b.x + b.w / 2}" cy="${b.y + b.h / 2}" rx="${b.w / 2 + 2}" ry="${b.h / 2 + 1.5}" fill="none" stroke="${color}" stroke-width="0.5"/>`);
    }
  }
  for (const s of strokes) {
    parts.push(`<polyline points="${s.points.map((p) => p.join(",")).join(" ")}" fill="none" stroke="${s.color}" stroke-width="0.6" stroke-linecap="round"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${height}" width="1200" height="${Math.round((1200 * height) / W)}"><rect width="${W}" height="${height}" fill="white"/>${parts.join("")}</svg>`;
}
