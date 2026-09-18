"use client";

import { useEffect, useRef, useState } from "react";
import { TutorBlocks } from "@/components/blocks/tutor-blocks";
import type { StoredMessage, TutorResponse, UserContent } from "@/lib/tutor/schema";
import { formatTime } from "@/lib/youtube";

export function UserBubble({ message, onSeek }: { message: StoredMessage; onSeek?: (t: number) => void }) {
  return (
    <div className="flex flex-col items-end gap-1">
      {message.video_timestamp !== null && onSeek && (
        <button onClick={() => onSeek(message.video_timestamp!)} className="text-xs font-medium text-accent hover:underline">
          @ {formatTime(message.video_timestamp)}
        </button>
      )}
      {message.drawing_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={message.drawing_url} alt="Your drawing" className="max-w-[70%] rounded-xl border border-line bg-white" />
      )}
      <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-stone-100 px-3 py-2 text-[15px]">
        {(message.content as UserContent).text}
      </p>
    </div>
  );
}

export function TutorMessage({
  message,
  isLatest,
  onRewatch,
  onReply,
  onResume,
  onAskAboutDrawing,
}: {
  message: StoredMessage;
  isLatest: boolean;
  onRewatch?: (t: number) => void;
  onReply: (text: string) => void;
  /** Absent outside video sessions (nothing to resume). */
  onResume?: () => void;
  onAskAboutDrawing?: (png: string) => void;
}) {
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
          {readableMisconception(content.misconception)}
        </p>
      )}
      {content.assessment && content.assessment.result !== "not_applicable" && (
        <p
          className={`text-xs font-semibold ${
            content.assessment.result === "correct" ? "text-green-700" : content.assessment.result === "partial" ? "text-amber-700" : "text-red-700"
          }`}
        >
          {content.assessment.result === "correct" ? "✓ Right" : content.assessment.result === "partial" ? "◐ Partly there" : "✗ Not quite"}
        </p>
      )}
      <TutorBlocks blocks={content.blocks} frameUrl={message.frame_url} onAskAboutDrawing={onAskAboutDrawing} />
      {isLatest && content.awaiting_student && (
        <div className="flex flex-wrap gap-2">
          <span className="w-full text-xs text-muted">Your turn. Type your answer, or:</span>
          {["I'm not sure", "Give me a hint", "Just tell me"].map((reply) => (
            <button key={reply} onClick={() => onReply(reply)} className="rounded-full border border-line px-3 py-1 text-sm hover:bg-stone-50">
              {reply}
            </button>
          ))}
        </div>
      )}
      {isLatest && content.resolved && onResume && <ResumePrompt onResume={onResume} />}
      <div className="flex items-center gap-2 text-xs text-muted">
        {content.rewatch_from !== null && onRewatch && (
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

/** Once Lumo marks a confusion resolved, offer to pick the lecture back up (auto after a few seconds). */
function ResumePrompt({ onResume }: { onResume: () => void }) {
  const [seconds, setSeconds] = useState(8);
  const [cancelled, setCancelled] = useState(false);
  const resumeRef = useRef(onResume);
  useEffect(() => {
    resumeRef.current = onResume;
  });
  useEffect(() => {
    if (cancelled) return;
    if (seconds <= 0) {
      resumeRef.current();
      return;
    }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds, cancelled]);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
      <span className="flex-1">{cancelled ? "Ready when you are." : `Back to the lecture in ${seconds}s`}</span>
      {!cancelled && (
        <button onClick={() => setCancelled(true)} className="text-xs text-green-800 underline">
          Stay here
        </button>
      )}
      <button onClick={onResume} className="rounded-full bg-green-700 px-3 py-1 text-xs font-medium text-white">
        ▶ Resume now
      </button>
    </div>
  );
}

const THINKING_STAGES = [
  { after: 0, text: "Looking at this moment" },
  { after: 8, text: "Working it out" },
  { after: 20, text: "Checking the math (harder questions take up to a minute)" },
  { after: 60, text: "Still checking, almost there" },
];

export function Thinking() {
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

/** The model sometimes names a misconception as a key ("chain-rule-forgets-inner-derivative"); show it as words. */
function readableMisconception(text: string) {
  if (/\s/.test(text) || !/[-_]/.test(text)) return text;
  const words = text.replace(/[-_]+/g, " ").replace(/\s*:\s*/g, ": ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
