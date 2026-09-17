"use client";

import { useState } from "react";
import { MarkdownBlock } from "./markdown-block";

export function CheckQuestion({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-dashed border-accent/40 bg-indigo-50/50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">Quick check</p>
      <MarkdownBlock md={question} />
      {open ? (
        <div className="mt-2 border-t border-accent/20 pt-2">
          <MarkdownBlock md={answer} />
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="mt-1 text-sm font-medium text-accent hover:underline">
          Show answer
        </button>
      )}
    </div>
  );
}
