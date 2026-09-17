"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export const MATERIAL_KINDS = [
  ["syllabus", "Syllabus"],
  ["slides", "Slides"],
  ["notes", "Notes"],
  ["textbook", "Textbook"],
  ["homework", "Homework"],
  ["exam", "Practice exam"],
  ["other", "Other"],
] as const;

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.txt,.md";
const MAX_BYTES = 18 * 1024 * 1024;

/** Guesses what a file is from its name, so dropping a folder of course files mostly just works. */
export function guessKind(name: string) {
  const n = name.toLowerCase();
  if (/syllab|course.?info|schedule|outline/.test(n)) return "syllabus";
  if (/midterm|final|exam|quiz|test/.test(n)) return "exam";
  if (/hw|homework|problem.?set|pset|assignment|worksheet/.test(n)) return "homework";
  if (/slide|lecture|lec\d|deck|ppt/.test(n)) return "slides";
  if (/chapter|textbook|ch\d|section/.test(n)) return "textbook";
  if (/note/.test(n)) return "notes";
  return "notes";
}

function mimeOf(file: File) {
  if (file.type) return file.type;
  if (file.name.endsWith(".md")) return "text/markdown";
  if (file.name.endsWith(".txt")) return "text/plain";
  return "";
}

/** Uploads one file straight to private storage, then asks the server to read it into the course map. */
export async function uploadCourseMaterial(courseId: string, file: File, kind: string) {
  if (file.size > MAX_BYTES) throw new Error("Over 18 MB. Try splitting the PDF.");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in first");
  const path = `${user.id}/${courseId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]+/g, "_")}`;
  const { error } = await supabase.storage.from("materials").upload(path, file, { contentType: mimeOf(file) || undefined });
  if (error) throw new Error(error.message);
  const res = await fetch(`/api/courses/${courseId}/materials`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storagePath: path, kind, title: file.name, mimeType: mimeOf(file) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Upload failed");
}

type Queued = { id: string; file: File; kind: string; state: "waiting" | "uploading" | "done" | "error"; error?: string };

/**
 * Drag files in or browse the computer. Files queue with a detected type the student can change,
 * then upload together. With `courseId` null, files are handed to `onPick` instead (for new courses).
 */
export function MaterialDropzone({
  courseId,
  onUploaded,
  onPick,
  compact = false,
  hint = "Syllabus, slides, notes, homework or practice exams",
}: {
  courseId: string | null;
  onUploaded?: () => void;
  onPick?: (files: { file: File; kind: string }[]) => void;
  compact?: boolean;
  hint?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [queue, setQueue] = useState<Queued[]>([]);
  const [busy, setBusy] = useState(false);

  function add(files: FileList | File[]) {
    const accepted = Array.from(files).filter((f) => /\.(pdf|png|jpe?g|webp|txt|md)$/i.test(f.name));
    const rejected = Array.from(files).length - accepted.length;
    const items: Queued[] = accepted.map((file) => ({ id: crypto.randomUUID(), file, kind: guessKind(file.name), state: "waiting" }));
    if (rejected) {
      items.push({
        id: crypto.randomUUID(),
        file: new File([], `${rejected} file${rejected > 1 ? "s" : ""} skipped`),
        kind: "other",
        state: "error",
        error: "Only PDF, images, or text. Export PowerPoint/Word to PDF first.",
      });
    }
    const next = [...queue, ...items];
    setQueue(next);
    onPick?.(next.filter((q) => q.state === "waiting").map((q) => ({ file: q.file, kind: q.kind })));
    // On an existing course, start right away; the detected type can still be fixed on retry.
    if (courseId) void uploadItems(items.filter((i) => i.state === "waiting"));
  }

  async function uploadAll() {
    await uploadItems(queue.filter((q) => q.state === "waiting" || q.state === "error"));
  }

  async function uploadItems(items: Queued[]) {
    if (!courseId || !items.length) return;
    setBusy(true);
    for (const item of items) {
      if (!item.file.size) continue;
      setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, state: "uploading", error: undefined } : x)));
      try {
        await uploadCourseMaterial(courseId, item.file, item.kind);
        setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, state: "done" } : x)));
      } catch (err) {
        setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, state: "error", error: err instanceof Error ? err.message : "Upload failed" } : x)));
      }
    }
    setBusy(false);
    onUploaded?.();
  }

  const pending = queue.filter((q) => (q.state === "waiting" || q.state === "error") && q.file.size).length;

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (e.dataTransfer.files.length) add(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed text-center transition ${
          compact ? "px-4 py-5" : "px-6 py-10"
        } ${over ? "border-pen bg-orange-50" : "border-ink/20 bg-stone-50/60 hover:border-ink/40 hover:bg-white"}`}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={over ? "text-pen" : "text-ink/50"} aria-hidden>
          <path d="M12 16V4m0 0-4 4m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" />
        </svg>
        <p className="mt-2 font-semibold">{over ? "Drop to add" : "Drag files here or browse your computer"}</p>
        <p className="mt-1 text-sm text-muted">{hint}</p>
        <p className="mt-1 text-xs text-muted">PDF, images or text · up to 18 MB each</p>
        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {queue.length > 0 && (
        <ul className="mt-3 space-y-2">
          {queue.map((q) => (
            <li key={q.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium">{q.file.name}</span>
              {q.file.size > 0 && (
                <select
                  value={q.kind}
                  disabled={q.state !== "waiting" && q.state !== "error"}
                  onChange={(e) => {
                    const next = queue.map((x) => (x.id === q.id ? { ...x, kind: e.target.value } : x));
                    setQueue(next);
                    onPick?.(next.filter((x) => x.state === "waiting").map((x) => ({ file: x.file, kind: x.kind })));
                  }}
                  className="rounded-lg border border-ink/15 bg-white px-2 py-1 text-xs"
                >
                  {MATERIAL_KINDS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  q.state === "done" ? "bg-green-100 text-green-900" : q.state === "error" ? "bg-red-100 text-red-900" : q.state === "uploading" ? "animate-pulse bg-amber-100 text-amber-900" : "bg-stone-100 text-stone-700"
                }`}
              >
                {q.state === "done" ? "uploaded" : q.state === "uploading" ? "uploading…" : q.state === "error" ? "failed" : "ready"}
              </span>
              {q.state === "waiting" && (
                <button onClick={() => setQueue((all) => all.filter((x) => x.id !== q.id))} aria-label={`Remove ${q.file.name}`} className="text-xs text-muted hover:text-ink">
                  ✕
                </button>
              )}
              {q.error && <p className="w-full text-xs text-red-600">{q.error}</p>}
            </li>
          ))}
        </ul>
      )}

      {courseId && pending > 0 && !busy && (
        <button onClick={uploadAll} disabled={busy} className="mt-3 w-full rounded-xl bg-ink py-2.5 text-sm font-medium text-white disabled:opacity-60">
          {busy ? "Uploading…" : `Retry ${pending} file${pending > 1 ? "s" : ""}`}
        </button>
      )}
    </div>
  );
}
