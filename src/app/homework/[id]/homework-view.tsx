"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Thinking, TutorMessage, UserBubble } from "@/components/chat/messages";
import type { StoredMessage } from "@/lib/tutor/schema";

type Page = { pageNumber: number; url: string; width: number; height: number };
type Problem = { id: string; label: string; prompt: string; page: number; status: string };
type Stroke = { color: string; points: [number, number][] };

const BOARD_W = 1000;
const PENS = ["#1c1b19", "#dc2626", "#2563eb"];
const SAVE_DELAY = 1200;

const STATUS_STYLE: Record<string, string> = {
  untouched: "bg-stone-100 text-stone-700",
  working: "bg-amber-100 text-amber-900",
  stuck: "bg-red-100 text-red-900",
  solved: "bg-green-100 text-green-900",
};

/**
 * Homework the way it's actually done: the page in front of you, your pen on it, and a tutor
 * that can see both. Questions carry the page and your handwriting, so help is about your work.
 */
export function HomeworkView(props: {
  assignment: { id: string; title: string; kind: string; status: string; error: string | null };
  pages: Page[];
  problems: Problem[];
  annotations: Record<number, Stroke[]>;
  sessionId: string;
  initialMode: "socratic" | "direct";
  initialMessages: StoredMessage[];
}) {
  const router = useRouter();
  const [pageIndex, setPageIndex] = useState(0);
  const [strokesByPage, setStrokesByPage] = useState<Record<number, Stroke[]>>(props.annotations);
  const [penColor, setPenColor] = useState(PENS[0]);
  const [drawing, setDrawing] = useState(true);
  const [messages, setMessages] = useState(props.initialMessages);
  const [problems, setProblems] = useState(props.problems);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState(props.initialMode);
  const [saved, setSaved] = useState(true);

  const svgRef = useRef<SVGSVGElement>(null);
  const active = useRef<Stroke | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const page = props.pages[pageIndex];
  const strokes = page ? (strokesByPage[page.pageNumber] ?? []) : [];
  const boardH = page ? Math.round((BOARD_W * page.height) / page.width) : BOARD_W;
  const working = props.assignment.status === "processing" || props.assignment.status === "pending";
  const guided = props.assignment.kind === "quiz" || props.assignment.kind === "exam";

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, sending]);

  // Problems appear once the extraction pass finishes; poll until then.
  useEffect(() => {
    if (!working) return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [working, router]);

  function queueSave(pageNumber: number, next: Stroke[]) {
    setSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await fetch(`/api/homework/${props.assignment.id}/annotations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageNumber, strokes: next }),
      }).catch(() => null);
      setSaved(true);
    }, SAVE_DELAY);
  }

  function updateStrokes(next: Stroke[]) {
    if (!page) return;
    setStrokesByPage((all) => ({ ...all, [page.pageNumber]: next }));
    queueSave(page.pageNumber, next);
  }

  const toBoard = (e: React.PointerEvent): [number, number] | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return [Number(p.x.toFixed(1)), Number(p.y.toFixed(1))];
  };

  /** The page with the student's writing on it: exactly what Lumo needs to see. */
  async function flattenPage(): Promise<string | null> {
    if (!page?.url) return null;
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = page.url;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = page.width;
      canvas.height = page.height;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const scale = page.width / BOARD_W;
      ctx.lineWidth = Math.max(2, 3 * scale);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const s of strokes) {
        ctx.strokeStyle = s.color;
        ctx.beginPath();
        s.points.forEach(([x, y], i) => (i ? ctx.lineTo(x * scale, y * scale) : ctx.moveTo(x * scale, y * scale)));
        ctx.stroke();
      }
      return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
    } catch (err) {
      console.error("couldn't flatten the page", err);
      return null;
    }
  }

  async function send(text: string) {
    const question = text.trim();
    if (!question || sending) return;
    const optimistic: StoredMessage = {
      id: `pending-${Date.now()}`,
      role: "user",
      video_timestamp: null,
      content: { text: question },
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    setDraft("");
    setSending(true);
    setError(null);

    const frame = await flattenPage();
    const res = await fetch(`/api/sessions/${props.sessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: question, timestamp: 0, frame, page: page?.pageNumber ?? 1 }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setDraft(question);
      return setError(data.error ?? "Lumo couldn't answer");
    }
    setMessages((m) => [...m.filter((x) => x.id !== optimistic.id), ...data.messages]);
  }

  async function setProblemStatus(problemId: string, status: string) {
    setProblems((all) => all.map((p) => (p.id === problemId ? { ...p, status } : p)));
    await fetch(`/api/homework/${props.assignment.id}/problems`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problemId, status }),
    }).catch(() => null);
  }

  async function setTutorMode(next: "socratic" | "direct") {
    setMode(next);
    await fetch(`/api/sessions/${props.sessionId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: next }) });
  }

  const pageProblems = problems.filter((p) => p.page === (page?.pageNumber ?? 1));

  return (
    <div className="flex h-dvh flex-col bg-[#fbfaf7] lg:flex-row">
      <section className="flex min-h-0 flex-col gap-3 p-3 lg:flex-1 lg:overflow-y-auto lg:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/homework" className="text-lg font-semibold tracking-tight">
            ← {props.assignment.title}
          </Link>
          <span className="text-sm text-muted">{saved ? "Saved" : "Saving…"}</span>
        </div>

        {props.assignment.status === "failed" && (
          <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{props.assignment.error ?? "Lumo couldn't read this file."} You can still write on it and ask questions.</p>
        )}
        {working && <p className="rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-900">Reading the problems off your pages…</p>}

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button
            onClick={() => setDrawing((d) => !d)}
            className={`rounded-full px-3 py-1 font-medium ${drawing ? "bg-ink text-white" : "border border-line bg-white"}`}
          >
            ✏️ {drawing ? "Writing" : "Write on the page"}
          </button>
          {drawing && (
            <>
              {PENS.map((c) => (
                <button
                  key={c}
                  aria-label="Pen color"
                  onClick={() => setPenColor(c)}
                  className={`h-5 w-5 rounded-full border-2 ${penColor === c ? "border-ink" : "border-white"}`}
                  style={{ background: c }}
                />
              ))}
              <button onClick={() => updateStrokes(strokes.slice(0, -1))} disabled={!strokes.length} className="rounded px-2 py-1 text-muted hover:text-ink disabled:opacity-40">
                Undo
              </button>
              <button onClick={() => updateStrokes([])} disabled={!strokes.length} className="rounded px-2 py-1 text-muted hover:text-ink disabled:opacity-40">
                Clear page
              </button>
            </>
          )}
          <span className="flex-1" />
          {props.pages.length > 1 && (
            <span className="flex items-center gap-2">
              <button onClick={() => setPageIndex((i) => Math.max(0, i - 1))} disabled={pageIndex === 0} className="rounded px-2 py-1 disabled:opacity-30">
                ◀
              </button>
              <span className="text-muted">
                Page {pageIndex + 1} / {props.pages.length}
              </span>
              <button onClick={() => setPageIndex((i) => Math.min(props.pages.length - 1, i + 1))} disabled={pageIndex === props.pages.length - 1} className="rounded px-2 py-1 disabled:opacity-30">
                ▶
              </button>
            </span>
          )}
        </div>

        {page ? (
          <figure className="overflow-hidden rounded-xl border border-line bg-white">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${BOARD_W} ${boardH}`}
              className={`block w-full touch-none select-none ${drawing ? "cursor-crosshair" : ""}`}
              role="img"
              aria-label={`Page ${page.pageNumber} of ${props.assignment.title}`}
              onPointerDown={(e) => {
                if (!drawing) return;
                const p = toBoard(e);
                if (!p) return;
                (e.target as Element).setPointerCapture?.(e.pointerId);
                const stroke: Stroke = { color: penColor, points: [p] };
                active.current = stroke;
                updateStrokes([...strokes, stroke]);
              }}
              onPointerMove={(e) => {
                if (!drawing || !active.current) return;
                const p = toBoard(e);
                if (!p) return;
                // Snapshot the stroke: the state update lands after pointer-up may clear the ref.
                const stroke: Stroke = { color: active.current.color, points: [...active.current.points, p] };
                active.current = stroke;
                updateStrokes([...strokes.slice(0, -1), stroke]);
              }}
              onPointerUp={() => {
                active.current = null;
              }}
              onPointerCancel={() => {
                active.current = null;
              }}
            >
              <image href={page.url} x={0} y={0} width={BOARD_W} height={boardH} preserveAspectRatio="none" />
              {strokes.map((s, i) => (
                <polyline
                  key={`ink-${i}`}
                  points={s.points.map((p) => p.join(",")).join(" ")}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </svg>
          </figure>
        ) : (
          <p className="text-muted">This assignment has no pages.</p>
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
                disabled={guided && value === "direct"}
                title={guided && value === "direct" ? "On a quiz or exam, Lumo only guides you." : undefined}
                className={`rounded-full px-3 py-1 font-medium disabled:opacity-40 ${mode === value ? "bg-white shadow-sm" : "text-muted hover:text-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {pageProblems.length > 0 && (
          <div className="max-h-52 overflow-y-auto border-b border-line p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Problems on this page</p>
            <ul className="mt-2 space-y-2">
              {pageProblems.map((p) => (
                <li key={p.id} className="rounded-xl border border-ink/10 p-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0">
                      <span className="font-semibold">{p.label}.</span> <span className="text-ink/75">{p.prompt.slice(0, 120)}</span>
                    </p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${STATUS_STYLE[p.status]}`}>{p.status}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                    <button onClick={() => send(`Help me with problem ${p.label}: ${p.prompt}`)} className="rounded-full bg-ink px-2.5 py-0.5 text-white">
                      Help me start
                    </button>
                    <button onClick={() => send(`Here's my work on problem ${p.label}. Check it and tell me where I went wrong, without giving me the answer.`)} className="rounded-full border border-ink/15 px-2.5 py-0.5">
                      Check my work
                    </button>
                    <button onClick={() => setProblemStatus(p.id, p.status === "solved" ? "working" : "solved")} className="rounded-full border border-ink/15 px-2.5 py-0.5">
                      {p.status === "solved" ? "Mark unsolved" : "Mark solved"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="mt-6 text-center text-muted">
              <p className="text-lg font-semibold text-foreground">Start writing, then ask.</p>
              <p className="mt-1 text-sm">Lumo sees the page and your handwriting{guided ? ". On a quiz it guides you, it won't hand over answers." : "."}</p>
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
              placeholder="Ask about this page, or answer Lumo's question"
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
