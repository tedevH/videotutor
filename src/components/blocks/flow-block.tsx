"use client";

import { useEffect, useId, useState } from "react";

export function FlowBlock({ title, mermaid }: { title: string; mermaid: string }) {
  const id = "m" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import("mermaid").then(async ({ default: m }) => {
      m.initialize({ startOnLoad: false, look: "handDrawn", theme: "neutral", securityLevel: "strict", fontFamily: "var(--font-caveat)" });
      try {
        const { svg } = await m.render(id, mermaid);
        if (!cancelled) setSvg(svg);
      } catch {
        if (!cancelled) setFailed(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id, mermaid]);

  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-white">
      {title && <figcaption className="border-b border-line px-3 py-2 font-hand text-xl">{title}</figcaption>}
      {failed ? (
        <pre className="overflow-x-auto p-3 text-xs text-muted">{mermaid}</pre>
      ) : svg ? (
        <div className="sketch-fade flex justify-center p-3 [&_svg]:h-auto [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="h-32 animate-pulse bg-stone-50" />
      )}
    </figure>
  );
}
