"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { TutorBlocks } from "@/components/blocks/tutor-blocks";
import { FilePlayer } from "@/components/players/file-player";
import { VimeoPlayer } from "@/components/players/vimeo-player";
import { YouTubePlayer, type PlayerHandle } from "@/components/youtube-player";
import { useTabCapture } from "@/lib/use-tab-capture";
import type { StoredMessage, TutorResponse, UserContent } from "@/lib/tutor/schema";
import { formatTime } from "@/lib/youtube";

const SAVE_POSITION_MS = 15_000;
// For sources Gemini can't watch directly, the browser keeps what the tutor needs.
const CAPTION_WINDOW_SECONDS = 180;
const RECENT_FRAME_EVERY_MS = 5000;
const RECENT_FRAMES = 6;
const RECENT_FRAME_WIDTH = 640;
const POLL_STATUS_MS = 5_000;

export function WatchView(props: {
  sessionId: string;
  videoId: string;
  provider: "youtube" | "vimeo" | "file";
  sourceUrl: string;
  title: string | null;
  channel: string | null;
  initialStatus: string;
  startAt: number;
  initialMessages: StoredMessage[];
}) {
  const player = useRef<PlayerHandle>(null);
  const playerBox = useRef<HTMLDivElement>(null);
  const capture = useTabCapture();
  /** Exact frame grabbed at the moment of pausing; reused for follow-ups until playback resumes. */
  const pausedFrame = useRef<string | null>(null);
  const captions = useRef<{ at: number; text: string }[]>([]);
  const recentFrames = useRef<string[]>([]);
  const needsLiveContext = props.provider === "vimeo";
  const input = useRef<HTMLTextAreaElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState(props.initialMessages);
  const [draft, setDraft] = useState("");
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<{ message: string; upgrade?: boolean } | null>(null);
  const [status, setStatus] = useState(props.initialStatus);
  const [duration, setDuration] = useState(0);

  // Poll until the shared video index is built.
  useEffect(() => {
    if (status === "ready" || status === "failed") return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/videos/${props.videoId}`);
      if (res.ok) setStatus((await res.json()).index_status);
    }, POLL_STATUS_MS);
    return () => clearInterval(t);
  }, [status, props.videoId]);

  const savePosition = useCallback(
    (keepalive = false) => {
      const position = player.current?.currentTime() ?? 0;
      if (!position) return;
      fetch(`/api/sessions/${props.sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position }),
        keepalive,
      });
    },
    [props.sessionId],
  );

  useEffect(() => {
    const t = setInterval(() => player.current?.isPlaying() && savePosition(), SAVE_POSITION_MS);
    const onHide = () => savePosition(true);
    window.addEventListener("pagehide", onHide);
    return () => {
      clearInterval(t);
      window.removeEventListener("pagehide", onHide);
    };
  }, [savePosition]);

  const { status: captureStatus, grab } = capture;
  useEffect(() => {
    if (!needsLiveContext || captureStatus !== "on") return;
    const t = setInterval(() => {
      if (!player.current?.isPlaying()) return;
      const frame = grab(playerBox.current, RECENT_FRAME_WIDTH);
      if (frame) recentFrames.current = [...recentFrames.current, frame].slice(-RECENT_FRAMES);
    }, RECENT_FRAME_EVERY_MS);
    return () => clearInterval(t);
  }, [needsLiveContext, captureStatus, grab]);

  function onCaption(text: string, at: number) {
    const last = captions.current[captions.current.length - 1];
    if (last?.text === text) return;
    captions.current = [...captions.current, { at, text }].filter((c) => c.at > at - CAPTION_WINDOW_SECONDS);
  }

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, sending]);

  /** The core interaction: the moment the student starts typing, freeze the video and remember where. */
  function freezeVideo() {
    if (pausedAt !== null || !player.current) return;
    // Grab the frame before pausing so YouTube's pause overlay isn't in the picture.
    pausedFrame.current = capture.grab(playerBox.current);
    const t = player.current.currentTime();
    player.current.pause();
    setPausedAt(t);
  }

  function resume(from?: number) {
    if (from !== undefined) player.current?.seek(from);
    player.current?.play();
    pausedFrame.current = null;
    setPausedAt(null);
  }

  function onPlayerStateChange(playing: boolean) {
    if (!duration) setDuration(player.current?.duration() ?? 0);
    // Student pressed play themselves: the next question is about a new moment.
    if (playing && !sending) {
      pausedFrame.current = null;
      setPausedAt(null);
    }
  }

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    if (pausedAt === null) freezeVideo();
    const timestamp = pausedAt ?? player.current?.currentTime() ?? 0;

    const optimistic: StoredMessage = {
      id: `pending-${Date.now()}`,
      role: "user",
      video_timestamp: Math.floor(timestamp),
      content: { text },
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    setDraft("");
    setSending(true);
    setError(null);

    try {
      const res = await fetch(`/api/sessions/${props.sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          timestamp,
          frame: pausedFrame.current,
          ...(needsLiveContext && {
            captions: captions.current.filter((c) => c.at <= timestamp + 1).map((c) => c.text).join(" "),
            recentFrames: recentFrames.current,
          }),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
        setDraft(text);
        setError({ message: data.error ?? "The tutor couldn't answer", upgrade: data.upgrade });
        return;
      }
      setMessages((m) => [...m.filter((x) => x.id !== optimistic.id), ...data.messages]);
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setDraft(text);
      setError({ message: e instanceof Error ? e.message : "Something went wrong" });
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
      return;
    }
    const typing = e.key.length === 1 || e.key === "Backspace";
    if (typing && !e.metaKey && !e.ctrlKey) freezeVideo();
  }

  // Global shortcuts outside the chat box: space toggles playback, "/" jumps to the chat.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (document.activeElement === input.current) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (e.key === " ") {
        e.preventDefault();
        if (player.current?.isPlaying()) player.current.pause();
        else resume();
      } else if (e.key === "/") {
        e.preventDefault();
        input.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function retryIndexing() {
    setStatus("processing");
    const res = await fetch("/api/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: props.sourceUrl }),
    });
    if (!res.ok) setStatus("failed");
  }

  const questionTimes = messages.filter((m) => m.role === "user" && m.video_timestamp !== null);

  return (
    <div className="flex h-dvh flex-col lg:flex-row">
      {/* Video column */}
      <section className="flex flex-col gap-3 p-3 lg:flex-1 lg:overflow-y-auto lg:p-5">
        <div className="flex items-center justify-between gap-3">
          <Link href="/library" className="text-lg font-semibold tracking-tight">
            ← VideoTutor
          </Link>
          <div className="flex items-center gap-2">
            <IndexStatus status={status} onRetry={retryIndexing} />
            <CaptureToggle status={capture.status} onStart={capture.start} onStop={capture.stop} />
          </div>
        </div>
        <div ref={playerBox}>
          {props.provider === "vimeo" ? (
            <VimeoPlayer ref={player} url={props.sourceUrl} start={props.startAt} onStateChange={onPlayerStateChange} onCaption={onCaption} />
          ) : props.provider === "file" ? (
            <FilePlayer ref={player} src={props.sourceUrl} start={props.startAt} onStateChange={onPlayerStateChange} />
          ) : (
            <YouTubePlayer ref={player} videoId={props.videoId} start={props.startAt} onStateChange={onPlayerStateChange} />
          )}
        </div>
        {duration > 0 && questionTimes.length > 0 && (
          <div className="relative h-4" aria-label="Moments you asked about">
            <div className="absolute inset-x-0 top-1/2 h-px bg-line" />
            {questionTimes.map((m) => (
              <button
                key={m.id}
                title={`Asked at ${formatTime(m.video_timestamp!)}`}
                onClick={() => resume(m.video_timestamp!)}
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent hover:scale-125"
                style={{ left: `${Math.min(100, (m.video_timestamp! / duration) * 100)}%` }}
              />
            ))}
          </div>
        )}
        <div className="hidden lg:block">
          <h1 className="text-lg font-semibold">{props.title}</h1>
          <p className="text-sm text-muted">{props.channel}</p>
        </div>
      </section>

      {/* Tutor column */}
      <aside className="flex min-h-0 flex-1 flex-col border-t border-line bg-white lg:max-w-[480px] lg:border-l lg:border-t-0">
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="mt-6 text-center text-muted">
              <p className="text-lg font-semibold text-foreground">Confused? Just start typing.</p>
              <p className="mt-1 text-sm">The video pauses and your tutor explains that exact moment — with diagrams.</p>
            </div>
          )}
          {messages.map((m) =>
            m.role === "user" ? (
              <UserBubble key={m.id} message={m} onSeek={(t) => resume(t)} />
            ) : (
              <TutorMessage key={m.id} message={m} onRewatch={(t) => resume(t)} />
            ),
          )}
          {sending && <Thinking />}
          <div ref={bottom} />
        </div>

        <div className="border-t border-line p-3">
          {pausedAt !== null && !sending && (
            <div className="mb-2 flex items-center justify-between text-xs text-muted">
              <span>Paused at {formatTime(pausedAt)}</span>
              <button onClick={() => resume()} className="rounded-full bg-stone-100 px-3 py-1 font-medium text-foreground hover:bg-stone-200">
                ▶ Resume
              </button>
            </div>
          )}
          {error && (
            <p className="mb-2 text-sm text-red-600">
              {error.message}{" "}
              {error.upgrade && (
                <Link href="/pricing" className="font-semibold underline">
                  See plans
                </Link>
              )}
            </p>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={input}
              value={draft}
              rows={1}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              onFocus={() => window.matchMedia("(pointer: coarse)").matches && freezeVideo()}
              placeholder="What's confusing? (typing pauses the video)"
              className="max-h-40 min-h-[44px] flex-1 resize-none rounded-xl border border-line px-3 py-2.5 text-[15px] outline-none field-sizing-content focus:border-accent"
            />
            <button
              onClick={send}
              disabled={!draft.trim() || sending}
              className="h-[44px] rounded-xl bg-accent px-4 font-medium text-white disabled:opacity-40"
            >
              Ask
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function IndexStatus({ status, onRetry }: { status: string; onRetry: () => void }) {
  if (status === "ready") return null;
  if (status === "live") {
    return (
      <span className="rounded-full bg-sky-50 px-3 py-1 text-xs text-sky-900" title="Vimeo videos can't be analyzed ahead of time.">
        Turn on exact diagrams so the tutor can see this video
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800">
        Video notes failed
        <button onClick={onRetry} className="font-semibold underline">
          Retry
        </button>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800">
      <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
      Taking notes on the video…
    </span>
  );
}

function CaptureToggle({
  status,
  onStart,
  onStop,
}: {
  status: "off" | "on" | "unsupported";
  onStart: () => Promise<boolean>;
  onStop: () => void;
}) {
  const [declined, setDeclined] = useState(false);
  if (status === "unsupported") return null;
  if (status === "on") {
    return (
      <button onClick={onStop} className="flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs text-green-800">
        <span className="h-2 w-2 rounded-full bg-green-500" />
        Exact diagrams on
      </button>
    );
  }
  return (
    <button
      onClick={async () => setDeclined(!(await onStart()))}
      title="Lets the tutor see the exact frame you paused on and draw on it. In the prompt, choose this tab."
      className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium hover:bg-stone-50"
    >
      {declined ? "Choose “This tab” to enable" : "📷 Enable exact diagrams"}
    </button>
  );
}

function UserBubble({ message, onSeek }: { message: StoredMessage; onSeek: (t: number) => void }) {
  return (
    <div className="flex flex-col items-end gap-1">
      {message.video_timestamp !== null && (
        <button onClick={() => onSeek(message.video_timestamp!)} className="text-xs font-medium text-accent hover:underline">
          @ {formatTime(message.video_timestamp)}
        </button>
      )}
      <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-stone-100 px-3 py-2 text-[15px]">
        {(message.content as UserContent).text}
      </p>
    </div>
  );
}

function TutorMessage({ message, onRewatch }: { message: StoredMessage; onRewatch: (t: number) => void }) {
  const content = message.content as TutorResponse;
  const [rating, setRating] = useState<1 | -1 | null>(null);

  async function rate(value: 1 | -1) {
    setRating(value);
    await fetch(`/api/messages/${message.id}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: value }),
    });
  }

  return (
    <div className="space-y-3">
      {content.misconception && (
        <p className="rounded-lg border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-sm">
          <span className="font-semibold">The tricky part: </span>
          {content.misconception}
        </p>
      )}
      <TutorBlocks blocks={content.blocks} frameUrl={message.frame_url} />
      <div className="flex items-center gap-2 text-xs text-muted">
        {content.rewatch_from !== null && (
          <button onClick={() => onRewatch(content.rewatch_from!)} className="rounded-full border border-line px-3 py-1 hover:bg-stone-50">
            ↺ Rewatch from {formatTime(content.rewatch_from)}
          </button>
        )}
        <span className="flex-1" />
        <button aria-label="Helpful" onClick={() => rate(1)} className={rating === 1 ? "text-green-600" : "hover:text-foreground"}>
          👍
        </button>
        <button aria-label="Not helpful" onClick={() => rate(-1)} className={rating === -1 ? "text-red-600" : "hover:text-foreground"}>
          👎
        </button>
      </div>
    </div>
  );
}

const THINKING_STAGES = [
  { after: 0, text: "Looking at this moment" },
  { after: 8, text: "Working it out" },
  { after: 20, text: "Checking the math (harder questions take up to a minute)" },
  { after: 60, text: "Still checking, almost there" },
];

function Thinking() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const stage = [...THINKING_STAGES].reverse().find((s) => seconds >= s.after)!;

  return (
    <div className="flex items-center gap-2 text-sm text-muted">
      <span>{stage.text}</span>
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </span>
    </div>
  );
}
