"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Thinking, TutorMessage, UserBubble } from "@/components/chat/messages";
import { FilePlayer } from "@/components/players/file-player";
import { VimeoPlayer } from "@/components/players/vimeo-player";
import { YouTubePlayer, type PlayerHandle } from "@/components/youtube-player";
import { useSpeech } from "@/lib/use-speech";
import { useTabCapture } from "@/lib/use-tab-capture";
import type { StoredMessage } from "@/lib/tutor/schema";
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
  initialMode: "socratic" | "direct";
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
  const [nudge, setNudge] = useState<string | null>(null);
  const rewinds = useRef<{ at: number; to: number }[]>([]);
  const lastSeen = useRef<{ time: number; playing: boolean; pausedSince: number | null }>({ time: 0, playing: false, pausedSince: null });
  const nudgedAt = useRef(0);
  const [mode, setMode] = useState(props.initialMode);

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
  // Classroom mode: notice when the student keeps rewinding the same part, or sits paused, and offer help.
  useEffect(() => {
    const t = setInterval(() => {
      const p = player.current;
      if (!p) return;
      const now = Date.now();
      const time = p.currentTime();
      const playing = p.isPlaying();
      const prev = lastSeen.current;
      if (prev.playing && time < prev.time - 3) {
        rewinds.current = [...rewinds.current, { at: now, to: time }].filter((r) => now - r.at < 120_000);
        const sameSpot = rewinds.current.filter((r) => Math.abs(r.to - time) < 45);
        if (sameSpot.length >= 2 && now - nudgedAt.current > 120_000) {
          nudgedAt.current = now;
          setNudge("You've rewound this part a few times. Want Lumo to explain it?");
        }
      }
      const pausedSince = playing ? null : (prev.pausedSince ?? now);
      if (!playing && pausedAt === null && pausedSince && now - pausedSince > 45_000 && now - nudgedAt.current > 300_000 && time > 5) {
        nudgedAt.current = now;
        setNudge("Stuck on something here? Ask Lumo.");
      }
      lastSeen.current = { time, playing, pausedSince };
    }, 1000);
    return () => clearInterval(t);
  }, [pausedAt]);

  const speech = useSpeech({
    onStart: () => freezeVideo(),
    onInterim: (text) => setDraft(text),
    onFinal: (text) => {
      if (!text) return;
      setDraft("");
      void send(text);
    },
  });

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

  async function setTutorMode(next: "socratic" | "direct") {
    setMode(next);
    await fetch(`/api/sessions/${props.sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: next }),
    });
  }

  async function send(override?: string, drawing?: string) {
    const text = (override ?? draft).trim();
    if ((!text && !drawing) || sending) return;
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
          drawing: drawing ?? null,
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
            ← LumoTutor
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
        <div className="flex items-center justify-between border-b border-line px-4 py-2 text-xs">
          <span className="font-semibold">Lumo</span>
          <div className="flex rounded-full bg-stone-100 p-0.5" role="radiogroup" aria-label="Tutoring style">
            {(
              [
                ["socratic", "Guide me"],
                ["direct", "Just explain"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                role="radio"
                aria-checked={mode === value}
                onClick={() => setTutorMode(value)}
                title={value === "socratic" ? "Lumo asks guiding questions so you work it out" : "Lumo explains fully right away"}
                className={`rounded-full px-3 py-1 font-medium transition ${mode === value ? "bg-white shadow-sm" : "text-muted hover:text-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
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
              <TutorMessage
                key={m.id}
                message={m}
                isLatest={m.id === messages[messages.length - 1]?.id && !sending}
                onRewatch={(t) => resume(t)}
                onReply={(text) => send(text)}
                onResume={() => resume()}
                onAskAboutDrawing={(png) => send("Here's what I drew. Is this right?", png)}
              />
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
          {nudge && !sending && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
              <span className="flex-1">{nudge}</span>
              <button
                onClick={() => {
                  setNudge(null);
                  freezeVideo();
                  input.current?.focus();
                }}
                className="rounded-full bg-sky-900 px-3 py-1 text-xs font-medium text-white"
              >
                Ask about it
              </button>
              <button onClick={() => setNudge(null)} className="text-xs text-sky-900/70" aria-label="Dismiss">
                ✕
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={input}
              value={draft}
              rows={1}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              onFocus={() => window.matchMedia("(pointer: coarse)").matches && freezeVideo()}
              placeholder={speech.listening ? "Listening…" : "What's confusing? (typing or talking pauses the video)"}
              className="max-h-40 min-h-[44px] flex-1 resize-none rounded-xl border border-line px-3 py-2.5 text-[15px] outline-none field-sizing-content focus:border-accent"
            />
            {speech.supported && (
              <button
                onClick={() => (speech.listening ? speech.stop() : speech.start())}
                aria-label={speech.listening ? "Stop listening" : "Ask out loud"}
                title="Ask out loud: the video pauses when you start talking"
                className={`h-[44px] w-[44px] shrink-0 rounded-xl border text-lg ${speech.listening ? "animate-pulse border-red-400 bg-red-50" : "border-line hover:bg-stone-50"}`}
              >
                🎙️
              </button>
            )}
            <button
              onClick={() => send()}
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
