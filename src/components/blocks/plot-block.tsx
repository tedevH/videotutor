"use client";

import { useEffect, useRef, useState } from "react";

const COLORS = ["#2563eb", "#dc2626", "#16a34a", "#ea580c"];

export function PlotBlock({
  title,
  functions,
  xDomain,
  yDomain,
}: {
  title: string;
  functions: { fn: string; label?: string }[];
  xDomain: [number, number];
  yDomain?: [number, number];
}) {
  const target = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    let cancelled = false;
    import("function-plot").then(({ default: functionPlot }) => {
      if (cancelled) return;
      el.innerHTML = "";
      try {
        const width = el.clientWidth;
        functionPlot({
          target: el,
          width,
          height: Math.round(width * 0.62),
          grid: true,
          disableZoom: true, // otherwise scrolling the chat zooms the graph
          xAxis: { domain: xDomain },
          yAxis: yDomain ? { domain: yDomain } : undefined,
          data: functions.map((f, i) => ({ fn: f.fn, color: COLORS[i % COLORS.length], title: f.label })),
        });
      } catch {
        setFailed(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [functions, xDomain, yDomain]);

  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-white">
      {title && <figcaption className="border-b border-line px-3 py-2 font-hand text-xl">{title}</figcaption>}
      {failed ? (
        <p className="p-3 text-sm text-muted">Couldn&apos;t draw this graph: {functions.map((f) => f.fn).join(", ")}</p>
      ) : (
        <div ref={target} className="sketch-fade w-full p-2" />
      )}
      {functions.some((f) => f.label) && (
        <div className="flex flex-wrap gap-3 border-t border-line px-3 py-2 text-xs">
          {functions.map((f, i) => (
            <span key={i} style={{ color: COLORS[i % COLORS.length] }}>
              ● {f.label ?? f.fn}
            </span>
          ))}
        </div>
      )}
    </figure>
  );
}
