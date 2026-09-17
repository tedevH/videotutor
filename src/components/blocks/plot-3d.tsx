"use client";

import { useEffect, useRef, useState } from "react";
import { compileExpr } from "@/lib/math-eval";

const N = 45;

type Props = {
  title: string;
  z: string;
  xDomain: [number, number];
  yDomain: [number, number];
  view: "surface" | "contour";
  points: { x: number; y: number; label: string }[];
  gradientsAt: { x: number; y: number }[];
  tangentPlaneAt: { x: number; y: number } | null;
};

/** z = f(x, y) as a rotatable surface or a contour map; gradients and tangent planes are computed numerically. */
export function Plot3D({ title, z, xDomain, yDomain, view, points, gradientsAt, tangentPlaneAt }: Props) {
  const target = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = target.current;
    const f = compileExpr(z, ["x", "y"]);
    if (!el || !f) {
      setError(`Couldn't read z = ${z}`);
      return;
    }
    let cancelled = false;
    // Surfaces need WebGL; without it, fall back to the contour map, which is plain SVG.
    const mode = view === "surface" && !hasWebGL() ? "contour" : view;

    const xs = linspace(xDomain, N);
    const ys = linspace(yDomain, N);
    const zs = ys.map((y) => xs.map((x) => finite(f(x, y))));
    const h = 1e-4;
    const grad = (x: number, y: number): [number, number] => [(f(x + h, y) - f(x - h, y)) / (2 * h), (f(x, y + h) - f(x, y - h)) / (2 * h)];

    import("plotly.js-dist-min").then((Plotly) => {
      if (cancelled) return;
      const data: Plotly.Data[] = [];
      const annotations: Partial<Plotly.Annotation>[] = [];

      if (mode === "contour") {
        data.push({ type: "contour", x: xs, y: ys, z: zs, colorscale: "YlGnBu", contours: { coloring: "heatmap", showlabels: true }, showscale: false } as Plotly.Data);
        for (const p of gradientsAt) {
          const [gx, gy] = grad(p.x, p.y);
          const scale = (0.18 * Math.min(xDomain[1] - xDomain[0], yDomain[1] - yDomain[0])) / (Math.hypot(gx, gy) || 1);
          annotations.push({
            x: p.x + gx * scale, y: p.y + gy * scale, ax: p.x, ay: p.y, xref: "x", yref: "y", axref: "x", ayref: "y",
            showarrow: true, arrowhead: 2, arrowwidth: 2.5, arrowcolor: "#d9480f", text: "",
          });
        }
        data.push({
          type: "scatter", mode: "text+markers", x: points.map((p) => p.x), y: points.map((p) => p.y), text: points.map((p) => p.label),
          textposition: "top center", marker: { color: "#1c1b19", size: 8 }, hoverinfo: "skip",
        });
      } else {
        data.push({ type: "surface", x: xs, y: ys, z: zs, colorscale: "YlGnBu", showscale: false, opacity: 0.95 } as Plotly.Data);
        data.push({
          type: "scatter3d", mode: "text+markers", x: points.map((p) => p.x), y: points.map((p) => p.y), z: points.map((p) => f(p.x, p.y)),
          text: points.map((p) => p.label), marker: { color: "#d9480f", size: 5 },
        } as Plotly.Data);
        if (tangentPlaneAt) {
          const { x: x0, y: y0 } = tangentPlaneAt;
          const z0 = f(x0, y0);
          const [gx, gy] = grad(x0, y0);
          const r = 0.35 * Math.min(xDomain[1] - xDomain[0], yDomain[1] - yDomain[0]);
          const px = linspace([x0 - r, x0 + r], 8);
          const pyv = linspace([y0 - r, y0 + r], 8);
          data.push({
            type: "surface", x: px, y: pyv, z: pyv.map((y) => px.map((x) => z0 + gx * (x - x0) + gy * (y - y0))),
            colorscale: [[0, "#d9480f"], [1, "#d9480f"]], showscale: false, opacity: 0.55,
          } as Plotly.Data);
        }
        for (const p of gradientsAt) {
          // Gradient lives in the xy-plane; draw it on the floor under the point.
          const [gx, gy] = grad(p.x, p.y);
          const scale = (0.18 * Math.min(xDomain[1] - xDomain[0], yDomain[1] - yDomain[0])) / (Math.hypot(gx, gy) || 1);
          const floor = Math.min(...zs.flat().filter((v): v is number => v !== null));
          data.push({
            type: "scatter3d", mode: "lines", x: [p.x, p.x + gx * scale], y: [p.y, p.y + gy * scale], z: [floor, floor],
            line: { color: "#d9480f", width: 8 }, hoverinfo: "skip",
          } as Plotly.Data);
        }
      }

      Plotly.newPlot(
        el,
        data,
        {
          margin: { l: 36, r: 12, t: 12, b: 36 },
          height: el.clientWidth * (mode === "contour" ? 0.8 : 0.85),
          showlegend: false,
          paper_bgcolor: "white",
          annotations,
          scene: { camera: { eye: { x: 1.5, y: -1.6, z: 1.1 } }, xaxis: { title: { text: "x" } }, yaxis: { title: { text: "y" } }, zaxis: { title: { text: "z" } } },
          xaxis: { title: { text: "x" } },
          yaxis: { title: { text: "y" }, scaleanchor: "x" },
        },
        { displayModeBar: false, responsive: true, scrollZoom: false },
      ).catch(() => setError("Couldn't draw this plot"));
    });

    return () => {
      cancelled = true;
      import("plotly.js-dist-min").then((Plotly) => Plotly.purge(el));
    };
  }, [z, xDomain, yDomain, view, points, gradientsAt, tangentPlaneAt]);

  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-white">
      {title && <figcaption className="border-b border-line px-3 py-2 text-sm font-semibold">{title}</figcaption>}
      {error ? <p className="p-3 text-sm text-muted">{error}</p> : <div ref={target} className="w-full" />}
      <p className="border-t border-line px-3 py-2 text-xs text-muted">
        z = {z}
        {view === "surface" ? " · drag to rotate" : ""}
        {gradientsAt.length ? " · orange arrows: ∇f" : ""}
        {tangentPlaneAt ? " · orange plane: tangent plane" : ""}
      </p>
    </figure>
  );
}

const linspace = ([a, b]: [number, number], n: number) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
const finite = (v: number) => (Number.isFinite(v) ? v : null);

function hasWebGL() {
  try {
    return !!document.createElement("canvas").getContext("webgl");
  } catch {
    return false;
  }
}
