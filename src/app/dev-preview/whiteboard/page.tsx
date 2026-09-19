"use client";

import { useState } from "react";
import { Whiteboard } from "@/components/board/whiteboard";

/** A blank, drawable board, as a new student sees it on /board. Dev only. */
export default function WhiteboardPreview() {
  const [sent, setSent] = useState<string | null>(null);
  if (process.env.NODE_ENV === "production") return null;
  return (
    <main className="mx-auto grid max-w-5xl gap-4 p-6">
      <Whiteboard title="Draw a problem, a diagram, or your attempt, then ask Lumo" ops={[]} allowDrawing onAskAboutDrawing={(png) => setSent(`${png.length} chars`)} />
      <p id="sent">{sent ?? "nothing sent"}</p>
    </main>
  );
}
