"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MaterialDropzone, uploadCourseMaterial } from "@/components/courses/material-dropzone";

export function NewCourseForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [examDate, setExamDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState<{ file: File; kind: string }[]>([]);

  return (
    <form
      className="h-fit rounded-2xl border-2 border-ink bg-[#fff1b8] p-5 shadow-[5px_5px_0_#1c1b19]"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        const res = await fetch("/api/courses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, subject, examDate }) });
        const data = await res.json();
        if (!res.ok) {
          setSaving(false);
          return setError(data.error);
        }
        // Upload anything dropped in before creating, so the course map starts building right away.
        for (const f of files) {
          await uploadCourseMaterial(data.courseId, f.file, f.kind).catch((err) => console.error("upload failed", f.file.name, err));
        }
        router.push(`/courses/${data.courseId}`);
      }}
    >
      <p className="font-semibold">New course</p>
      <label className="mt-3 block text-sm">
        Name
        <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Physics 7B" className="mt-1 w-full rounded-lg border border-ink/20 bg-white px-3 py-2" />
      </label>
      <label className="mt-3 block text-sm">
        Subject
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="electromagnetism" className="mt-1 w-full rounded-lg border border-ink/20 bg-white px-3 py-2" />
      </label>
      <label className="mt-3 block text-sm">
        Next exam (optional)
        <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className="mt-1 w-full rounded-lg border border-ink/20 bg-white px-3 py-2" />
      </label>
      <div className="mt-3 text-sm">
        <p>Syllabus &amp; materials (optional)</p>
        <div className="mt-1">
          <MaterialDropzone courseId={null} compact hint="Drop your syllabus here" onPick={setFiles} />
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button disabled={saving} className="mt-4 w-full rounded-xl bg-ink py-2.5 font-medium text-white disabled:opacity-60">
        {saving ? (files.length ? "Creating & uploading…" : "Creating…") : "Create course"}
      </button>
    </form>
  );
}
