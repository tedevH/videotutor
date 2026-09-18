"use client";

import { useEffect, useMemo, useState } from "react";
import { latestBoardOf } from "@/app/board/[sessionId]/board-view";
import { Whiteboard } from "@/components/board/whiteboard";
import { Thinking, TutorMessage, UserBubble } from "@/components/chat/messages";
import { DemoVideo } from "@/components/landing/demo-video";
import type { StoredMessage, TutorResponse } from "@/lib/tutor/schema";
import { DemoWorksheet, WORKSHEET_H, WORKSHEET_W } from "./demo-worksheet";
import fixtures from "./fixtures.json";

/**
 * A scripted walkthrough for a social demo video, recorded frame by frame.
 * Every Lumo reply here is a real model answer (fixtures.json), played back through the real components.
 */
export const REEL_W = 1920;
export const REEL_H = 1080;

const SCENES = {
  intro: [0, 3200],
  lecture: [3200, 19400],
  board: [19400, 38400],
  homework: [38400, 50400],
  outro: [50400, 55000],
} as const;
export const REEL_MS = SCENES.outro[1];

const TYPE_MS = 38;
const noop = () => {};

const msg = (id: string, role: "user" | "assistant", content: unknown): StoredMessage => ({
  id,
  role,
  video_timestamp: null,
  content: content as StoredMessage["content"],
  created_at: "2026-09-18T00:00:00Z",
});

/**
 * Milliseconds since the reel started. With ?wait in the URL it holds at 0 until the recorder
 * calls window.startReel(), so recording and the script begin on the same frame.
 */
function useClock() {
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf = 0;
    let start = 0;
    const tick = () => {
      setT(performance.now() - start);
      raf = requestAnimationFrame(tick);
    };
    const begin = () => {
      start = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const w = window as unknown as { startReel?: () => void };
    if (new URLSearchParams(location.search).has("wait")) w.startReel = begin;
    else begin();
    return () => cancelAnimationFrame(raf);
  }, []);
  return t;
}

const typed = (text: string, t: number, start: number) => text.slice(0, Math.max(0, Math.floor((t - start) / TYPE_MS)));

export function Reel() {
  const t = useClock();
  const scene = (Object.keys(SCENES) as (keyof typeof SCENES)[]).find((k) => t >= SCENES[k][0] && t < SCENES[k][1]) ?? "outro";
  const local = t - SCENES[scene][0];

  return (
    <div style={{ width: REEL_W, height: REEL_H }} className="relative overflow-hidden bg-[#f4f1ea] text-ink">
      <div
        className="absolute inset-0 opacity-60"
        style={{ backgroundImage: "linear-gradient(#1c1b1910 1px, transparent 1px), linear-gradient(90deg, #1c1b1910 1px, transparent 1px)", backgroundSize: "48px 48px" }}
      />
      {scene === "intro" && <Intro t={local} />}
      {scene === "lecture" && <LectureScene t={local} />}
      {scene === "board" && <BoardScene t={local} />}
      {scene === "homework" && <HomeworkScene t={local} />}
      {scene === "outro" && <Outro t={local} />}
    </div>
  );
}

function fadeIn(t: number, at: number, ms = 450) {
  return Math.min(1, Math.max(0, (t - at) / ms));
}

function Intro({ t }: { t: number }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
      <p className="text-[34px] font-medium text-ink/60" style={{ opacity: fadeIn(t, 100) }}>
        Stuck at 1am with a lecture that makes no sense?
      </p>
      <h1 className="mt-6 text-[104px] font-semibold leading-none tracking-tight" style={{ opacity: fadeIn(t, 1100), transform: `translateY(${(1 - fadeIn(t, 1100)) * 24}px)` }}>
        Just ask <span className="text-pen">Lumo</span>.
      </h1>
    </div>
  );
}

function Caption({ n, text, t }: { n: number; text: string; t: number }) {
  return (
    <div
      className="absolute left-1/2 top-[42px] flex -translate-x-1/2 items-center gap-4 rounded-full border-2 border-ink bg-white px-7 py-3 shadow-[5px_5px_0_#1c1b19]"
      style={{ opacity: fadeIn(t, 0, 350) }}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-pen text-[22px] font-bold text-white">{n}</span>
      <span className="whitespace-nowrap text-[30px] font-semibold tracking-tight">{text}</span>
    </div>
  );
}

/** A browser window, so it's obviously a real web app at a real address. */
function Window({ url, children, className = "" }: { url: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`absolute overflow-hidden rounded-2xl border border-ink/15 bg-white shadow-[0_30px_80px_-20px_rgba(28,27,25,0.35)] ${className}`}>
      <div className="flex h-11 items-center gap-2 border-b border-ink/10 bg-[#f7f5f0] px-4">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <span className="ml-4 flex-1 rounded-md bg-white px-3 py-1 text-[15px] text-ink/60">{url}</span>
      </div>
      {children}
    </div>
  );
}

function LectureScene({ t }: { t: number }) {
  return (
    <>
      <Caption n={1} text="Pause any lecture and ask about that exact moment" t={t} />
      <Window url="lumotutor.com/watch" className="left-[200px] top-[140px] h-[870px] w-[1520px]">
        <div className="p-4">
          <DemoVideo />
        </div>
      </Window>
    </>
  );
}

function BoardScene({ t }: { t: number }) {
  const q1At = 600;
  const a1At = q1At + fixtures.q1.length * TYPE_MS + 1400;
  const q2At = a1At + 5600;
  const a2At = q2At + fixtures.q2.length * TYPE_MS + 1300;

  const messages: StoredMessage[] = [];
  if (t >= q1At) messages.push(msg("q1", "user", { text: t < a1At - 1400 ? typed(fixtures.q1, t, q1At) : fixtures.q1 }));
  if (t >= a1At) messages.push(msg("a1", "assistant", fixtures.r1));
  if (t >= q2At) messages.push(msg("q2", "user", { text: t < a2At - 1300 ? typed(fixtures.q2, t, q2At) : fixtures.q2 }));
  if (t >= a2At) messages.push(msg("a2", "assistant", fixtures.r2));
  const thinking = (t >= a1At - 1400 && t < a1At) || (t >= a2At - 1300 && t < a2At);
  // Rebuild the board only when an answer lands, like the real page: a new ops array restarts the drawing.
  const answers = (t >= a1At ? 1 : 0) + (t >= a2At ? 1 : 0);
  const board = useMemo(
    () => latestBoardOf([fixtures.r1, fixtures.r2].slice(0, answers).map((r, i) => msg(`a${i + 1}`, "assistant", r))),
    [answers],
  );

  return (
    <>
      <Caption n={2} text="Work through problems together on a shared whiteboard" t={t} />
      <Window url="lumotutor.com/board" className="left-[80px] top-[140px] h-[900px] w-[1760px]">
        <div className="flex h-[856px]">
          <div className="flex-1 bg-[#fbfaf7] p-6">
            <Whiteboard
              title={board?.title ?? "Draw a problem, a diagram, or your attempt, then ask Lumo"}
              ops={board?.ops ?? []}
              steps={board?.steps ?? []}
              stepMs={900}
            />
          </div>
          <ChatPane messages={messages.map(withoutBoard)} thinking={thinking} />
        </div>
      </Window>
    </>
  );
}

/** The board already fills the left pane; the chat keeps the words so the video stays readable. */
function withoutBoard(m: StoredMessage): StoredMessage {
  if (m.role !== "assistant") return m;
  const c = m.content as TutorResponse;
  return { ...m, content: { ...c, blocks: c.blocks.filter((b) => b.type !== "board") } };
}

function HomeworkScene({ t }: { t: number }) {
  const inkAt = 400;
  const qAt = 2600;
  const aAt = qAt + fixtures.q3.length * TYPE_MS + 1500;
  const ink = Math.min(1, Math.max(0, (t - inkAt) / 1600));

  const messages: StoredMessage[] = [];
  if (t >= qAt) messages.push(msg("q3", "user", { text: t < aAt - 1500 ? typed(fixtures.q3, t, qAt) : fixtures.q3 }));
  if (t >= aAt) messages.push(msg("a3", "assistant", fixtures.r3));
  const thinking = t >= aAt - 1500 && t < aAt;
  const pageScale = 820 / WORKSHEET_H;

  return (
    <>
      <Caption n={3} text="Drop in your homework. Lumo reads what you wrote." t={t} />
      <Window url="lumotutor.com/homework" className="left-[80px] top-[140px] h-[900px] w-[1760px]">
        <div className="flex h-[856px]">
          <div className="flex flex-1 items-start justify-center bg-[#fbfaf7] pt-4">
            <div className="overflow-hidden rounded-lg border border-ink/10 shadow-sm" style={{ width: WORKSHEET_W * pageScale, height: WORKSHEET_H * pageScale }}>
              <div style={{ transform: `scale(${pageScale})`, transformOrigin: "0 0" }}>
                <DemoWorksheet inkProgress={ink} />
              </div>
            </div>
          </div>
          <ChatPane messages={messages} thinking={thinking} />
        </div>
      </Window>
    </>
  );
}

function ChatPane({ messages, thinking }: { messages: StoredMessage[]; thinking: boolean }) {
  return (
    // Zoomed so the conversation stays readable on a phone-sized Reddit player.
    <aside className="flex w-[480px] flex-col border-l border-line bg-white" style={{ zoom: 1.25 }}>
      <div className="border-b border-line px-5 py-3 text-[15px] font-semibold">Lumo</div>
      <div className="flex flex-1 flex-col justify-end gap-4 overflow-hidden p-5 text-[17px]">
        {messages.map((m, i) =>
          m.role === "user" ? (
            <UserBubble key={m.id} message={m} />
          ) : (
            <TutorMessage key={m.id} message={m} isLatest={i === messages.length - 1 && !thinking} onReply={noop} />
          ),
        )}
        {thinking && <Thinking />}
      </div>
    </aside>
  );
}

function Outro({ t }: { t: number }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
      <h2 className="text-[88px] font-semibold leading-none tracking-tight" style={{ opacity: fadeIn(t, 100) }}>
        lumotutor<span className="text-pen">.com</span>
      </h2>
      <p className="mt-8 text-[36px] text-ink/70" style={{ opacity: fadeIn(t, 700) }}>
        Your personal AI teacher for every class. Free to start.
      </p>
    </div>
  );
}
