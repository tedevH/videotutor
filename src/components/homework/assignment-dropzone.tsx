"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { uploadAssignment } from "@/lib/homework/upload";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp";

const KINDS = [
  ["homework", "Homework"],
  ["quiz", "Quiz"],
  ["exam", "Exam"],
  ["notes", "Notes"],
] as const;

/** Guesses homework vs quiz from the filename so the integrity rules apply without being asked. */
export function guessAssignmentKind(name: string) {
  const n = name.toLowerCase();
  if (/quiz/.test(n)) return "quiz";
  if (/exam|midterm|final|test\b/.test(n)) return "exam";
  if (/note/.test(n)) return "notes";
  return "homework";
}

/** Drop a problem set, quiz or a photo of your work; it becomes a page you can write on. */
export function AssignmentDropzone({ courseId = null, compact = false }: { courseId?: string | null; compact?: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [kind, setKind] = useState<string>("homework");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handle(files: FileList | File[]) {
    const file = Array.from(files).find((f) => /\.(pdf|png|jpe?g|webp)$/i.test(f.name));
    if (!file) return setError("Upload a PDF or a photo of the assignment.");
    setError(null);
    setStatus("Reading the file…");
    try {
      const { assignmentId, truncated } = await uploadAssignment(file, {
        kind: kind === "homework" ? guessAssignmentKind(file.name) : kind,
        courseId,
        onProgress: setStatus,
      });
      if (truncated) setStatus("Only the first 12 pages were read. Opening…");
      router.push(`/homework/${assignmentId}`);
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !status && input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !status && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (e.dataTransfer.files.length) void handle(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed text-center transition ${
          compact ? "px-4 py-5" : "px-6 py-10"
        } ${over ? "border-pen bg-orange-50" : "border-ink/20 bg-stone-50/60 hover:border-ink/40 hover:bg-white"} ${status ? "pointer-events-none opacity-70" : ""}`}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={over ? "text-pen" : "text-ink/50"} aria-hidden>
          <path d="M12 16V4m0 0-4 4m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" />
        </svg>
        <p className="mt-2 font-semibold">{status ?? (over ? "Drop to upload" : "Drop your homework here, or browse")}</p>
        <p className="mt-1 text-sm text-muted">A problem set, quiz, or a photo of the work you&apos;ve done</p>
        <p className="mt-1 text-xs text-muted">PDF or image · up to 25 MB · first 12 pages</p>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void handle(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">This is a</span>
        {KINDS.map(([value, label]) => (
          <button
            key={value}
            onClick={() => setKind(value)}
            className={`rounded-full px-3 py-1 ${kind === value ? "bg-ink font-medium text-white" : "border border-ink/15 bg-white hover:border-ink/40"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {kind === "quiz" || kind === "exam" ? (
        <p className="mt-2 text-xs text-muted">On a quiz or exam, Lumo guides you and won&apos;t hand over final answers.</p>
      ) : null}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
