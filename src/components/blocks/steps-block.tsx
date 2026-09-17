"use client";

import katex from "katex";
import { useState } from "react";
import { MarkdownBlock } from "./markdown-block";

/** A derivation revealed one line at a time, so the student can try the next step first. */
export function StepsBlock({ title, steps }: { title: string; steps: { math: string; note: string }[] }) {
  const [shown, setShown] = useState(1);

  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-white">
      {title && <figcaption className="border-b border-line px-3 py-2 text-sm font-semibold">{title}</figcaption>}
      <ol className="divide-y divide-line">
        {steps.slice(0, shown).map((s, i) => (
          <li key={i} className="sketch-fade flex gap-3 px-3 py-2.5">
            <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stone-100 text-[11px] font-semibold text-muted">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="overflow-x-auto" dangerouslySetInnerHTML={{ __html: renderMath(s.math) }} />
              {s.note && <MarkdownBlock md={s.note} className="text-sm text-muted [&_p]:my-0.5" />}
            </div>
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-2 border-t border-line px-3 py-2 text-sm">
        <span className="flex-1 text-xs text-muted">
          Step {shown} of {steps.length}
        </span>
        {shown < steps.length ? (
          <>
            <button onClick={() => setShown(steps.length)} className="rounded px-2 py-1 text-muted hover:bg-stone-100">
              Show all
            </button>
            <button onClick={() => setShown((n) => n + 1)} className="rounded-full bg-foreground px-3 py-1 font-medium text-white">
              Next step
            </button>
          </>
        ) : (
          <button onClick={() => setShown(1)} className="rounded px-2 py-1 text-muted hover:bg-stone-100">
            ↺ Start over
          </button>
        )}
      </div>
    </figure>
  );
}

function renderMath(tex: string) {
  const clean = tex.trim().replace(/^\$+|\$+$/g, "");
  return katex.renderToString(clean, { displayMode: true, throwOnError: false, output: "html" });
}
