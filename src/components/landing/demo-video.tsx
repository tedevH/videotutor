"use client";

import { useEffect, useRef, useState } from "react";
import { LectureBoard } from "./lecture-board";

/** Stage is laid out at a fixed 1200 x 675 and scaled to fit, so camera moves are simple pixel math. */
const STAGE_W = 1200;
const STAGE_H = 675;
const LOOP_MS = 19000;
const TICK_MS = 80;

const QUESTION = "wait, why is dA/dx = x²?";

type Rect = { x: number; y: number; w: number; h: number };

const CHAPTERS = [
  { at: 0, label: "Watch" },
  { at: 3200, label: "Ask" },
  { at: 7000, label: "Explain" },
  { at: 11200, label: "Draw" },
  { at: 15600, label: "Resume" },
];

const CAPTIONS = [
  { at: 0, text: "So as we nudge x forward by a tiny amount…" },
  { at: 1400, text: "the area grows by a thin strip we call dA." },
  { at: 15800, text: "and that's exactly why the derivative of the area is x²." },
];

/** Where the camera looks at each moment. */
function cameraFor(t: number): { focus: Rect | null; scale: number } {
  if (t < 3000) return { focus: null, scale: 1 };
  if (t < 6400) return { focus: { x: 808, y: 560, w: 368, h: 100 }, scale: 2.1 }; // typing
  if (t < 7400) return { focus: null, scale: 1 }; // sent, video paused
  if (t < 11000) return { focus: { x: 808, y: 64, w: 368, h: 420 }, scale: 1.55 }; // answer
  if (t < 15400) return { focus: { x: 824, y: 330, w: 336, h: 200 }, scale: 2.45 }; // annotated frame
  return { focus: null, scale: 1 };
}

function cameraTransform({ focus, scale }: { focus: Rect | null; scale: number }) {
  if (!focus) return "translate(0px, 0px) scale(1)";
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const tx = clamp(STAGE_W / 2 - scale * (focus.x + focus.w / 2), STAGE_W - STAGE_W * scale, 0);
  const ty = clamp(STAGE_H / 2 - scale * (focus.y + focus.h / 2), STAGE_H - STAGE_H * scale, 0);
  return `translate(${tx}px, ${ty}px) scale(${scale})`;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function DemoVideo() {
  const outer = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(0.5);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = outer.current;
    if (!el) return;
    const resize = new ResizeObserver(([entry]) => setFit(entry.contentRect.width / STAGE_W));
    const seen = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.25 });
    resize.observe(el);
    seen.observe(el);
    return () => {
      resize.disconnect();
      seen.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!playing || !visible) return;
    const id = setInterval(() => setT((v) => (v + TICK_MS) % LOOP_MS), TICK_MS);
    return () => clearInterval(id);
  }, [playing, visible]);

  // Derived scene state
  const typedChars = t < 3900 ? 0 : Math.min(QUESTION.length, Math.floor((t - 3900) / 75));
  const paused = t >= 3900 && t < 15800;
  const sent = t >= 6300;
  const thinking = t >= 6600 && t < 7600;
  const answered = t >= 7600;
  const frameShown = t >= 9000;
  const drawStep = t < 11600 ? 0 : t < 12900 ? 1 : t < 14100 ? 2 : 3;
  const resumePressed = t >= 15400;
  // 12:58 at the start, frozen at 13:02 while paused, then playing on after resume.
  const videoSeconds = 778.2 + Math.min(t, 3900) / 1000 + Math.max(0, t - 15800) / 1000;
  const caption = [...CAPTIONS].reverse().find((c) => t >= c.at)?.text;
  const chapter = [...CHAPTERS].reverse().find((c) => t >= c.at)!;

  return (
    <figure className="w-full">
      <div className="overflow-hidden rounded-[18px] border border-ink/15 bg-ink p-1.5 shadow-[0_30px_80px_-30px_rgba(28,27,25,0.45)] sm:p-2">
        <div ref={outer} className="relative w-full overflow-hidden rounded-xl bg-[#fbfaf7]" style={{ aspectRatio: `${STAGE_W} / ${STAGE_H}` }}>
          <div className="absolute left-0 top-0" style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${fit})`, transformOrigin: "0 0" }}>
            <div className="demo-camera relative h-full w-full" style={{ transform: cameraTransform(cameraFor(t)) }}>
              {/* app bar */}
              <div className="absolute inset-x-6 top-0 flex h-14 items-center justify-between">
                <span className="text-[24px] font-semibold tracking-tight">VideoTutor</span>
                <span className="rounded-full border border-ink/10 bg-white px-4 py-1.5 text-[15px] text-muted">Calculus I · Lecture 7</span>
              </div>

              {/* player */}
              <div className="absolute left-6 top-16 h-[428px] w-[760px] overflow-hidden rounded-xl bg-black">
                <LectureBoard className="h-full w-full" />
                {caption && !paused && (
                  <p className="absolute inset-x-0 bottom-5 text-center">
                    <span className="rounded bg-black/70 px-3 py-1 text-[20px] text-white">{caption}</span>
                  </p>
                )}
                <div className={`absolute inset-0 flex items-center justify-center bg-black/35 transition-opacity duration-300 ${paused ? "opacity-100" : "opacity-0"}`}>
                  <span className="flex items-center gap-3 rounded-full bg-white px-5 py-2.5 text-[18px] font-medium shadow">
                    <span className="flex gap-1">
                      <span className="h-4 w-1.5 rounded-sm bg-ink" />
                      <span className="h-4 w-1.5 rounded-sm bg-ink" />
                    </span>
                    Paused at 13:02
                  </span>
                </div>
              </div>
              <div className="absolute left-6 top-[504px] w-[760px]">
                <div className="h-1.5 rounded-full bg-ink/10">
                  <div className="h-full rounded-full bg-pen" style={{ width: `${(videoSeconds / 1025) * 100}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-[15px] text-muted">
                  <span className="tabular-nums">{fmt(videoSeconds)} / 17:05</span>
                  {sent && <span className="font-medium text-pen">● asked here</span>}
                </div>
                <p className="mt-4 text-[24px] font-semibold">Area under a curve and the derivative</p>
                <p className="text-[16px] text-muted">Intro to Calculus</p>
              </div>

              {/* tutor panel */}
              <div className="absolute right-6 top-16 flex h-[587px] w-[368px] flex-col rounded-xl border border-ink/10 bg-white">
                <div className="flex-1 space-y-3 overflow-hidden p-4">
                  {!sent && (
                    <p className="mt-24 text-center text-[18px] text-muted">Confused? Just start typing.</p>
                  )}
                  {sent && (
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[13px] font-medium text-accent">@ 13:02</span>
                      <p className="rounded-2xl rounded-tr-sm bg-stone-100 px-3 py-2 text-[16px]">{QUESTION}</p>
                    </div>
                  )}
                  {thinking && (
                    <p className="flex items-center gap-2 text-[15px] text-muted">
                      Looking at 13:02
                      <span className="flex gap-1">
                        {[0, 1, 2].map((i) => (
                          <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${i * 150}ms` }} />
                        ))}
                      </span>
                    </p>
                  )}
                  {answered && (
                    <div className="sketch-fade space-y-2.5">
                      <p className="rounded-md border-l-[3px] border-amber-400 bg-amber-50 px-2.5 py-1.5 text-[14px] leading-snug">
                        <b>The tricky part:</b> dA is the thin strip, not the whole area.
                      </p>
                      <p className="text-[15px] leading-snug">
                        Nudge x by dx and the strip is almost a rectangle: height <i>x²</i>, width <i>dx</i>. So dA ≈ x²·dx, and dividing by dx
                        gives <b>dA/dx = x²</b>.
                      </p>
                    </div>
                  )}
                  {frameShown && (
                    <div className="sketch-fade overflow-hidden rounded-lg border border-ink/10">
                      <div className="relative">
                        <LectureBoard className="block w-full" />
                        <svg viewBox="0 0 760 428" className="absolute inset-0 h-full w-full">
                          {drawStep >= 1 && (
                            <ellipse cx="448" cy="290" rx="34" ry="106" fill="none" stroke="#ffd43b" strokeWidth="7" pathLength={1} className="sketch-stroke" style={{ ["--dur" as string]: "900ms" }} />
                          )}
                          {drawStep >= 2 && (
                            <path d="M640,330 Q560,318 490,262 M490,262 L512,264 M490,262 L497,283" fill="none" stroke="#ff6b6b" strokeWidth="7" strokeLinecap="round" pathLength={1} className="sketch-stroke" />
                          )}
                          {drawStep >= 3 && (
                            <text x="575" y="378" fill="#ff8787" fontSize="34" className="sketch-fade" stroke="#22302a" strokeWidth="8" paintOrder="stroke">
                              height = x²
                            </text>
                          )}
                        </svg>
                      </div>
                      <p className="border-t border-ink/10 px-2.5 py-1.5 text-[13px] text-muted">
                        {drawStep < 2 ? "This yellow strip is dA." : "Its height is the curve's value at x, which is x²."}
                      </p>
                    </div>
                  )}
                </div>
                <div className="border-t border-ink/10 p-3">
                  {paused && (
                    <div className="mb-2 flex items-center justify-between text-[13px] text-muted">
                      <span>Paused at 13:02</span>
                      <span className={`rounded-full px-3 py-1 font-medium text-ink transition ${resumePressed ? "scale-95 bg-ink text-white" : "bg-stone-100"}`}>▶ Resume</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <div className={`flex h-11 flex-1 items-center rounded-xl border px-3 text-[16px] ${typedChars && !sent ? "border-accent" : "border-ink/15"}`}>
                      {typedChars && !sent ? (
                        <span className="caret">{QUESTION.slice(0, typedChars)}</span>
                      ) : (
                        <span className="text-muted">What&apos;s confusing?</span>
                      )}
                    </div>
                    <span className="flex h-11 items-center rounded-xl bg-accent px-4 text-[16px] font-medium text-white">Ask</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* player controls */}
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-sm">
        <button
          onClick={() => setPlaying((p) => !p)}
          className="flex items-center gap-2 rounded-full border border-ink/15 bg-white px-3 py-1.5 font-medium hover:bg-stone-50"
          aria-label={playing ? "Pause demo" : "Play demo"}
        >
          {playing ? "❚❚ Pause" : "▶ Play"}
        </button>
        <ol className="flex flex-wrap items-center gap-1">
          {CHAPTERS.map((c, i) => (
            <li key={c.label} className="flex items-center gap-1">
              {i > 0 && <span className="text-ink/25">·</span>}
              <button
                onClick={() => setT(c.at)}
                className={`rounded px-1.5 py-0.5 transition ${c === chapter ? "font-semibold text-ink" : "text-muted hover:text-ink"}`}
              >
                {c.label}
              </button>
            </li>
          ))}
        </ol>
        <span className="ml-auto tabular-nums text-muted">
          0:{String(Math.floor(t / 1000)).padStart(2, "0")} / 0:{Math.floor(LOOP_MS / 1000)}
        </span>
      </figcaption>
    </figure>
  );
}
