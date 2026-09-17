"use client";

import { useEffect, useState } from "react";

type Frame = {
  caption: string;
  items: string[];
  highlight: number[];
  pointers: { label: string; index: number }[];
  tree: { id: string; value: string; parent: string | null }[];
  edges: { from: string; to: string; label: string }[];
  highlight_ids: string[];
};

const HL = "#fde68a";
const STROKE = "#1c1b19";
const FRAME_MS = 2200;

/** Algorithms and memory, frame by frame: arrays, linked lists, stacks (call stack), trees and graphs. */
export function DataStructure({ title, kind, frames, directed }: { title: string; kind: "array" | "linked_list" | "tree" | "graph" | "stack"; frames: Frame[]; directed: boolean }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(frames.length > 1);
  useEffect(() => {
    if (!playing) return;
    if (i >= frames.length - 1) {
      const t = setTimeout(() => setPlaying(false), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setI((n) => n + 1), FRAME_MS);
    return () => clearTimeout(t);
  }, [playing, i, frames.length]);

  const frame = frames[Math.min(i, frames.length - 1)];
  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-white">
      {title && <figcaption className="border-b border-line px-3 py-2 text-sm font-semibold">{title}</figcaption>}
      <div className="overflow-x-auto p-3">
        {kind === "array" && <ArrayView frame={frame} />}
        {kind === "linked_list" && <LinkedListView frame={frame} />}
        {kind === "stack" && <StackView frame={frame} />}
        {kind === "tree" && <TreeView frame={frame} />}
        {kind === "graph" && <GraphView frame={frame} directed={directed} />}
      </div>
      <div className="flex items-center gap-2 border-t border-line px-3 py-2">
        <p className="min-h-[1.5rem] flex-1 text-sm text-muted">{frame.caption}</p>
        {frames.length > 1 && (
          <>
            <span className="text-xs tabular-nums text-muted">
              {i + 1}/{frames.length}
            </span>
            <button aria-label="Previous" disabled={i === 0} onClick={() => { setPlaying(false); setI((n) => n - 1); }} className="rounded px-2 py-1 text-sm hover:bg-stone-100 disabled:opacity-30">
              ◀
            </button>
            <button aria-label="Next" disabled={i >= frames.length - 1} onClick={() => { setPlaying(false); setI((n) => n + 1); }} className="rounded px-2 py-1 text-sm hover:bg-stone-100 disabled:opacity-30">
              ▶
            </button>
            <button aria-label="Replay" onClick={() => { setI(0); setPlaying(true); }} className="rounded px-2 py-1 text-sm hover:bg-stone-100">
              ↺
            </button>
          </>
        )}
      </div>
    </figure>
  );
}

function ArrayView({ frame }: { frame: Frame }) {
  const cell = 48;
  const w = Math.max(1, frame.items.length) * cell + 20;
  return (
    <svg viewBox={`0 0 ${w} 110`} width={w} height={110} className="mx-auto block">
      {frame.items.map((v, k) => (
        <g key={k}>
          <rect x={10 + k * cell} y={20} width={cell} height={cell} fill={frame.highlight.includes(k) ? HL : "#fff"} stroke={STROKE} strokeWidth="1.5" className="transition-colors" />
          <text x={10 + k * cell + cell / 2} y={20 + cell / 2 + 5} textAnchor="middle" fontSize="15" fontWeight="600">
            {v}
          </text>
          <text x={10 + k * cell + cell / 2} y={14} textAnchor="middle" fontSize="10" fill="#6b6860">
            {k}
          </text>
        </g>
      ))}
      {frame.pointers.map((p, k) => {
        const x = 10 + p.index * cell + cell / 2;
        return (
          <g key={k}>
            <path d={`M${x},${96 - k * 0} L${x},${74} M${x - 5},${80} L${x},${72} L${x + 5},${80}`} fill="none" stroke="#d9480f" strokeWidth="2" />
            <text x={x} y={108} textAnchor="middle" fontSize="12" fontWeight="600" fill="#d9480f">
              {p.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function LinkedListView({ frame }: { frame: Frame }) {
  const nodeW = 58;
  const gap = 34;
  const w = frame.items.length * (nodeW + gap) + 60;
  return (
    <svg viewBox={`0 0 ${w} 110`} width={w} height={110} className="mx-auto block">
      {frame.items.map((v, k) => {
        const x = 10 + k * (nodeW + gap);
        return (
          <g key={k}>
            <rect x={x} y={34} width={nodeW} height={36} rx="6" fill={frame.highlight.includes(k) ? HL : "#fff"} stroke={STROKE} strokeWidth="1.5" />
            <line x1={x + 40} y1={34} x2={x + 40} y2={70} stroke={STROKE} strokeWidth="1" />
            <text x={x + 20} y={57} textAnchor="middle" fontSize="14" fontWeight="600">
              {v}
            </text>
            <circle cx={x + 49} cy={52} r="3" fill={STROKE} />
            <path d={`M${x + 49},52 L${x + nodeW + gap - 4},52 M${x + nodeW + gap - 10},47 L${x + nodeW + gap - 3},52 L${x + nodeW + gap - 10},57`} fill="none" stroke={STROKE} strokeWidth="1.5" />
          </g>
        );
      })}
      <text x={10 + frame.items.length * (nodeW + gap) + 4} y={57} fontSize="13" fill="#6b6860">
        null
      </text>
      {frame.pointers.map((p, k) => {
        const x = 10 + p.index * (nodeW + gap) + 20;
        return (
          <g key={k}>
            <text x={x} y={14 + k * 0} textAnchor="middle" fontSize="12" fontWeight="600" fill="#d9480f">
              {p.label}
            </text>
            <path d={`M${x},18 L${x},32 M${x - 4},27 L${x},33 L${x + 4},27`} fill="none" stroke="#d9480f" strokeWidth="2" />
          </g>
        );
      })}
    </svg>
  );
}

function StackView({ frame }: { frame: Frame }) {
  const rowH = 34;
  const h = Math.max(1, frame.items.length) * rowH + 40;
  return (
    <svg viewBox={`0 0 260 ${h}`} width={260} height={h} className="mx-auto block">
      {frame.items.map((v, k) => {
        const y = h - 20 - (k + 1) * rowH;
        const top = k === frame.items.length - 1;
        return (
          <g key={k}>
            <rect x={30} y={y} width={200} height={rowH - 4} rx="5" fill={frame.highlight.includes(k) || top ? HL : "#fff"} stroke={STROKE} strokeWidth="1.5" />
            <text x={130} y={y + rowH / 2 + 3} textAnchor="middle" fontSize="13" fontFamily="ui-monospace, monospace">
              {v}
            </text>
          </g>
        );
      })}
      <text x={236} y={h - 20 - frame.items.length * rowH + 18} fontSize="10" fill="#6b6860">
        top
      </text>
      <line x1={20} y1={h - 18} x2={240} y2={h - 18} stroke={STROKE} strokeWidth="2" />
    </svg>
  );
}

/** Simple tidy layout: leaves spread left to right, parents centered over children. */
function layoutTree(nodes: Frame["tree"]) {
  const children = new Map<string | null, string[]>();
  for (const n of nodes) children.set(n.parent, [...(children.get(n.parent) ?? []), n.id]);
  const pos = new Map<string, { x: number; depth: number }>();
  let leaf = 0;
  const place = (id: string, depth: number): number => {
    const kids = children.get(id) ?? [];
    const x = kids.length ? kids.map((k) => place(k, depth + 1)).reduce((a, b) => a + b, 0) / kids.length : leaf++;
    pos.set(id, { x, depth });
    return x;
  };
  for (const root of children.get(null) ?? []) place(root, 0);
  return { pos, width: Math.max(1, leaf), depth: Math.max(0, ...[...pos.values()].map((p) => p.depth)) };
}

function TreeView({ frame }: { frame: Frame }) {
  const { pos, width, depth } = layoutTree(frame.tree);
  const sx = (x: number) => 30 + x * 56;
  const sy = (d: number) => 30 + d * 64;
  const w = sx(width - 1) + 30;
  const h = sy(depth) + 30;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="mx-auto block">
      {frame.tree.map((n) => {
        if (!n.parent || !pos.has(n.parent)) return null;
        const a = pos.get(n.parent)!;
        const b = pos.get(n.id)!;
        return <line key={`e-${n.id}`} x1={sx(a.x)} y1={sy(a.depth)} x2={sx(b.x)} y2={sy(b.depth)} stroke={STROKE} strokeWidth="1.5" />;
      })}
      {frame.tree.map((n) => {
        const p = pos.get(n.id);
        if (!p) return null;
        return (
          <g key={n.id}>
            <circle cx={sx(p.x)} cy={sy(p.depth)} r="19" fill={frame.highlight_ids.includes(n.id) ? HL : "#fff"} stroke={STROKE} strokeWidth="1.5" />
            <text x={sx(p.x)} y={sy(p.depth) + 5} textAnchor="middle" fontSize="13" fontWeight="600">
              {n.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function GraphView({ frame, directed }: { frame: Frame; directed: boolean }) {
  const nodes = frame.tree;
  const R = Math.max(70, nodes.length * 16);
  const size = R * 2 + 70;
  const at = new Map(nodes.map((n, k) => [n.id, [size / 2 + R * Math.cos((2 * Math.PI * k) / nodes.length - Math.PI / 2), size / 2 + R * Math.sin((2 * Math.PI * k) / nodes.length - Math.PI / 2)] as [number, number]]));
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="mx-auto block max-w-full">
      {frame.edges.map((e, k) => {
        const a = at.get(e.from);
        const b = at.get(e.to);
        if (!a || !b) return null;
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        const end: [number, number] = [b[0] - 21 * Math.cos(ang), b[1] - 21 * Math.sin(ang)];
        const on = frame.highlight_ids.includes(e.from) && frame.highlight_ids.includes(e.to);
        return (
          <g key={k}>
            <line x1={a[0]} y1={a[1]} x2={end[0]} y2={end[1]} stroke={on ? "#d9480f" : STROKE} strokeWidth={on ? 2.5 : 1.5} />
            {directed && <path d={`M${end[0] - 8 * Math.cos(ang - 0.4)},${end[1] - 8 * Math.sin(ang - 0.4)} L${end[0]},${end[1]} L${end[0] - 8 * Math.cos(ang + 0.4)},${end[1] - 8 * Math.sin(ang + 0.4)}`} fill="none" stroke={on ? "#d9480f" : STROKE} strokeWidth="1.5" />}
            {e.label && (
              <text x={(a[0] + b[0]) / 2} y={(a[1] + b[1]) / 2 - 4} textAnchor="middle" fontSize="11" fill="#6b6860" stroke="white" strokeWidth="3" paintOrder="stroke">
                {e.label}
              </text>
            )}
          </g>
        );
      })}
      {nodes.map((n) => {
        const [x, y] = at.get(n.id)!;
        return (
          <g key={n.id}>
            <circle cx={x} cy={y} r="19" fill={frame.highlight_ids.includes(n.id) ? HL : "#fff"} stroke={STROKE} strokeWidth="1.5" />
            <text x={x} y={y + 5} textAnchor="middle" fontSize="13" fontWeight="600">
              {n.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
