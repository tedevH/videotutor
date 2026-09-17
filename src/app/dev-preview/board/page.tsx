import { TutorBlocks } from "@/components/blocks/tutor-blocks";
import { tutorResponse } from "@/lib/tutor/schema";

const sample = tutorResponse.parse({
  move: "example",
  blocks: [
    {
      type: "board",
      title: "Chain rule on the board",
      ops: [
        { op: "write", id: "f", step: 1, x: 5, y: 6, text: "$h(x) = \\sin(x^2)$", size: "lg", color: "ink" },
        { op: "write", id: "outer", step: 2, x: 5, y: 18, text: "outer: $\\sin(u)$, inner: $u = x^2$", size: "md", color: "blue" },
        { op: "write", id: "d", step: 3, x: 5, y: 30, text: "$h'(x) = \\cos(x^2) \\cdot 2x$", size: "lg", color: "ink" },
        { op: "highlight", step: 4, target: "d", color: "orange" },
        { op: "graph", id: "g", step: 3, x: 58, y: 8, w: 36, h: 40, fn: "sin(x^2)", xDomain: [-3, 3], yDomain: [-1.2, 1.2], color: "purple", shade: null },
        { op: "draw", step: 4, shape: "arrow", points: [[40, 42], [52, 30]], color: "red", label: "slope" },
      ],
      steps: [
        { step: 1, narration: "Start with the function." },
        { step: 2, narration: "Split it into outer and inner pieces." },
        { step: 3, narration: "Derivative of the outer, evaluated at the inner, times the inner's derivative." },
        { step: 4, narration: "That product is the slope of the purple curve." },
      ],
    },
  ],
});

export default function BoardPreview() {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <main className="mx-auto grid max-w-5xl gap-6 p-6">
      <TutorBlocks blocks={sample.blocks} />
    </main>
  );
}
