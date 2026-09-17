"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Whiteboard } from "@/components/board/whiteboard";
import { Thinking, TutorMessage, UserBubble } from "@/components/chat/messages";
import type { BoardOp, StoredMessage, TutorResponse } from "@/lib/tutor/schema";

/** Lumo as a teacher at a whiteboard: the board is the main surface, conversation on the side. */
export function BoardView(props: { sessionId: string; initialMode: "socratic" | "direct"; initialMessages: StoredMessage[] }) {
  const [messages, setMessages] = useState(props.initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState(props.initialMode);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, sending]);

  const latestBoard = latestBoardOf(messages);

  async function send(text: string, drawing?: string) {
    const question = text.trim();
    if ((!question && !drawing) || sending) return;
    const optimistic: StoredMessage = {
      id: `pending-${Date.now()}`,
      role: "user",
      video_timestamp: null,
      content: { text: question || "Here's what I drew. Is this right?" },
      created_at: new Date().toISOString(),
      drawing_url: drawing ? `data:image/png;base64,${drawing}` : null,
    };
    setMessages((m) => [...m, optimistic]);
    setDraft("");
    setSending(true);
    setError(null);
    const res = await fetch(`/api/sessions/${props.sessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: question, timestamp: 0, drawing: drawing ?? null }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setDraft(question);
      setError(data.error ?? "Lumo couldn't answer");
      return;
    }
    setMessages((m) => [...m.filter((x) => x.id !== optimistic.id), ...data.messages]);
  }

  async function setTutorMode(next: "socratic" | "direct") {
    setMode(next);
    await fetch(`/api/sessions/${props.sessionId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: next }) });
  }

  return (
    <div className="flex h-dvh flex-col bg-[#fbfaf7] lg:flex-row">
      <section className="flex min-h-0 flex-col gap-3 p-3 lg:flex-1 lg:overflow-y-auto lg:p-5">
        <div className="flex items-center justify-between">
          <Link href="/home" className="text-lg font-semibold tracking-tight">
            ← LumoTutor
          </Link>
          <span className="text-sm text-muted">Whiteboard</span>
        </div>
        <Whiteboard
          key={latestBoard?.key ?? "blank"}
          title={latestBoard?.title ?? "Draw a problem, a diagram, or your attempt, then ask Lumo"}
          ops={latestBoard?.ops ?? []}
          steps={latestBoard?.steps ?? []}
          allowDrawing
          onAskAboutDrawing={(png) => send(draft, png)}
        />
        {!latestBoard && (
          <p className="text-sm text-muted">
            Tip: type a question like <i>&ldquo;teach me how to find a limit by factoring&rdquo;</i> and Lumo will work through it on the board with you.
          </p>
        )}
      </section>

      <aside className="flex min-h-0 flex-1 flex-col border-t border-line bg-white lg:max-w-[460px] lg:border-l lg:border-t-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-2 text-xs">
          <span className="font-semibold">Lumo</span>
          <div className="flex rounded-full bg-stone-100 p-0.5">
            {(
              [
                ["socratic", "Guide me"],
                ["direct", "Just explain"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setTutorMode(value)}
                className={`rounded-full px-3 py-1 font-medium ${mode === value ? "bg-white shadow-sm" : "text-muted hover:text-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="mt-6 text-center text-muted">
              <p className="text-lg font-semibold text-foreground">What are we working on?</p>
              <p className="mt-1 text-sm">Ask anything, or draw on the board and send it.</p>
            </div>
          )}
          {messages.map((m) =>
            m.role === "user" ? (
              <UserBubble key={m.id} message={m} />
            ) : (
              <TutorMessage key={m.id} message={m} isLatest={m.id === messages[messages.length - 1]?.id && !sending} onReply={(t) => send(t)} />
            ),
          )}
          {sending && <Thinking />}
          <div ref={bottom} />
        </div>
        <div className="border-t border-line p-3">
          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              rows={1}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(draft);
                }
              }}
              placeholder="Ask Lumo, or answer its question"
              className="max-h-40 min-h-[44px] flex-1 resize-none rounded-xl border border-line px-3 py-2.5 text-[15px] outline-none field-sizing-content focus:border-accent"
            />
            <button onClick={() => send(draft)} disabled={!draft.trim() || sending} className="h-[44px] rounded-xl bg-accent px-4 font-medium text-white disabled:opacity-40">
              Ask
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

/** The big board shows Lumo's most recent board; a blank one invites the student to start. */
function latestBoardOf(messages: StoredMessage[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant") continue;
    const board = (m.content as TutorResponse).blocks?.find((b) => b.type === "board");
    if (board && board.type === "board") return { key: m.id, title: board.title, ops: board.ops as BoardOp[], steps: board.steps };
  }
  return null;
}
