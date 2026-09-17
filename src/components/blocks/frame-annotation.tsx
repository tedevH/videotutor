"use client";

import { useEffect, useMemo, useState } from "react";
import { INK, roughArrow, roughEllipse, roughRect, roughSegment, rng } from "@/lib/sketch";
import { MarkdownBlock } from "./markdown-block";
import type { FrameAnnotation as Annotation } from "@/lib/tutor/schema";

const STEP_MS = 2200;
const W = 1000;

type Box = [number, number, number, number];

/**
 * The student's real paused frame with hand-drawn annotations on top: exact by construction,
 * since nothing is redrawn. Model coordinates are Gemini-native [y, x] normalized to 0-1000.
 */
export function FrameAnnotation({
  frameUrl,
  title,
  crop,
  annotations,
  steps,
}: {
  frameUrl: string | null | undefined;
  title: string;
  crop: Box | null;
  annotations: Annotation[];
  steps: { step: number; narration: string }[];
}) {
  const [aspect, setAspect] = useState(16 / 9);
  const [step, setStep] = useState(1);
  const [autoplay, setAutoplay] = useState(true);
  const [run, setRun] = useState(0);
  const maxStep = Math.max(1, ...annotations.map((a) => a.step), ...steps.map((s) => s.step));

  useEffect(() => {
    if (!frameUrl) return;
    const img = new Image();
    img.onload = () => img.naturalHeight && setAspect(img.naturalWidth / img.naturalHeight);
    img.src = frameUrl;
  }, [frameUrl]);

  useEffect(() => {
    if (!autoplay || step >= maxStep) return;
    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [autoplay, step, maxStep]);

  // Canvas in frame pixels scaled to width 1000; the crop becomes the SVG viewBox.
  const H = W / aspect;
  const view = useMemo(() => {
    const [ymin, xmin, ymax, xmax] = normalizeBox(crop ?? [0, 0, 1000, 1000]);
    const x = (xmin / 1000) * W;
    const y = (ymin / 1000) * H;
    return { x, y, w: Math.max(40, ((xmax - xmin) / 1000) * W), h: Math.max(30, ((ymax - ymin) / 1000) * H) };
  }, [crop, H]);

  // Stroke widths and text scale with the zoom so annotations look the same size on screen.
  const unit = view.w / 100;
  const shapes = useMemo(() => buildShapes(annotations, H, unit), [annotations, H, unit]);

  if (!frameUrl) return null;
  const narration = steps.find((s) => s.step === step)?.narration;

  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-white">
      {title && <figcaption className="border-b border-line px-3 py-2 font-hand text-xl">{title}</figcaption>}
      <svg key={run} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} className="block max-h-[60vh] w-full bg-black" role="img" aria-label={title}>
        <image
          href={frameUrl}
          x={0}
          y={0}
          width={W}
          height={H}
          preserveAspectRatio="none"
        />
        {shapes
          .filter((s) => s.step <= step)
          .map((s, i) =>
            s.kind === "path" ? (
              <path
                key={`${s.step}-${i}`}
                d={s.d}
                pathLength={1}
                fill="none"
                stroke={s.color}
                strokeWidth={unit * 0.7}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="sketch-stroke"
                style={{ filter: "drop-shadow(0 0 1.5px rgba(0,0,0,0.9))" }}
              />
            ) : (
              <text
                key={`${s.step}-${i}`}
                x={s.x}
                y={s.y}
                fontSize={unit * 5}
                fill={s.color}
                textAnchor="middle"
                stroke="rgba(0,0,0,0.85)"
                strokeWidth={unit * 1.2}
                paintOrder="stroke"
                className="sketch-fade font-hand"
                style={{ ["--delay" as string]: "400ms" }}
              >
                {s.text}
              </text>
            ),
          )}
      </svg>
      <div className="flex items-center gap-2 border-t border-line px-3 py-2">
        <div className="min-h-[1.5rem] flex-1 text-sm text-muted [&_p]:my-0">{narration && <MarkdownBlock md={narration} className="text-sm" />}</div>
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
          aria-label="Replay"
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

type Shape =
  | { kind: "path"; d: string; color: string; step: number }
  | { kind: "text"; x: number; y: number; text: string; color: string; step: number };

function normalizeBox([a, b, c, d]: Box): Box {
  const clamp = (v: number) => Math.min(1000, Math.max(0, v));
  return [clamp(Math.min(a, c)), clamp(Math.min(b, d)), clamp(Math.max(a, c)), clamp(Math.max(b, d))];
}

function buildShapes(annotations: Annotation[], H: number, unit: number): Shape[] {
  // [y, x] in 0-1000 → canvas [x, y]
  const pt = ([y, x]: [number, number]): [number, number] => [(x / 1000) * W, (y / 1000) * H];

  return annotations.flatMap((a, i): Shape[] => {
    const rand = rng(i + 1.7);
    const color = INK[a.color] ?? INK.yellow;
    if ((a.kind === "circle" || a.kind === "box" || a.kind === "underline") && a.box_2d) {
      const [ymin, xmin, ymax, xmax] = normalizeBox(a.box_2d);
      const [x0, y0] = pt([ymin, xmin]);
      const [x1, y1] = pt([ymax, xmax]);
      const pad = unit * 1.5;
      const d =
        a.kind === "circle"
          ? roughEllipse((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2 + pad * 2, (y1 - y0) / 2 + pad * 2, rand)
          : a.kind === "box"
            ? roughRect(x0 - pad, y0 - pad, x1 + pad, y1 + pad, rand, unit)
            : roughSegment([x0, y1 + pad], [x1, y1 + pad], rand, true, unit);
      return [{ kind: "path", d, color, step: a.step }];
    }
    if (a.kind === "arrow" && a.from && a.to) {
      const { shaft, head } = roughArrow(pt(a.from), pt(a.to), rand, unit * 3, unit);
      return [{ kind: "path", d: `${shaft} ${head}`, color, step: a.step }];
    }
    if (a.kind === "label" && a.point && a.text) {
      const [x, y] = pt(a.point);
      return [{ kind: "text", x, y, text: a.text, color, step: a.step }];
    }
    // Not placed by the grounding pass.
    return [];
  });
}
