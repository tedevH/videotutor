import { notFound } from "next/navigation";
import { TutorBlocks } from "@/components/blocks/tutor-blocks";
import { tutorResponse } from "@/lib/tutor/schema";

const sample = tutorResponse.parse({
  misconception: "Thinking the normal force always equals mg.",
  rewatch_from: 312,
  blocks: [
    { type: "text", md: "On a ramp, gravity splits into two parts. Only the part **into** the ramp is balanced: $N = mg\\cos\\theta$." },
    {
      type: "diagram",
      title: "Block on an incline",
      elements: [
        { kind: "line", points: [[10, 50], [90, 50], [90, 15], [10, 50]], step: 1 },
        { kind: "rect", x: 52, y: 22, w: 14, h: 10, label: "m", step: 1 },
        { kind: "arrow", from: [59, 27], to: [59, 48], label: "mg", color: "red", step: 2 },
        { kind: "arrow", from: [59, 27], to: [52, 12], label: "N", color: "blue", step: 3 },
        { kind: "arrow", from: [59, 27], to: [66, 42], label: "mg cos θ", color: "orange", dashed: true, step: 4 },
        { kind: "highlight", cx: 62, cy: 36, r: 9, color: "red", step: 4 },
        { kind: "text", x: 25, y: 10, text: "N ≠ mg", size: "lg", color: "red", step: 4 },
      ],
      steps: [
        { step: 1, narration: "Here's the block on the ramp." },
        { step: 2, narration: "Gravity pulls straight down." },
        { step: 3, narration: "The normal force pushes perpendicular to the surface." },
        { step: 4, narration: "It only balances the part of gravity into the ramp." },
      ],
    },
    { type: "flow", title: "Solving it", mermaid: "flowchart TD\n  A[Draw forces] --> B[Tilt axes]\n  B --> C[\"Sum forces ⊥ ramp\"]\n  C --> D[\"N = mg cos θ\"]" },
    { type: "plot", title: "N vs angle", functions: [{ fn: "cos(x)", label: "N / mg" }], xDomain: [0, 1.6], yDomain: [0, 1.1] },
    { type: "check_question", question: "What is $N$ when $\\theta = 0$?", answer: "$N = mg$ — the ramp is flat." },
  ],
});

/** Renders a sample tutor answer so diagram work doesn't need API keys. Dev only. */
const advanced = tutorResponse.parse({
  misconception: "",
  rewatch_from: null,
  blocks: [
    {
      type: "steps",
      title: "Eigenvectors of A = [[3,1],[0,3]]",
      steps: [
        { math: "\\det(A-\\lambda I) = (3-\\lambda)^2 = 0", note: "triangular, so multiply the diagonal" },
        { math: "\\lambda_1 = \\lambda_2 = 3", note: "one repeated eigenvalue" },
        { math: "A - 3I = \\begin{bmatrix}0&1\\\\0&0\\end{bmatrix}", note: "rank 1, so the null space is 1-dimensional" },
        { math: "x = \\begin{bmatrix}1\\\\0\\end{bmatrix}", note: "only one independent eigenvector" },
      ],
    },
    { type: "transform2d", title: "A shears the plane", matrix: [[3, 1], [0, 3]], vectors: [{ x: 0, y: 1, label: "not an eigenvector" }], show_eigenvectors: true },
    { type: "plot3d", title: "Saddle z = x² − y²", z: "x^2 - y^2", xDomain: [-2, 2], yDomain: [-2, 2], view: "surface", points: [{ x: 0, y: 0, label: "saddle point" }], gradients_at: [], tangent_plane_at: { x: 1, y: 0.5 } },
    { type: "plot3d", title: "Level curves and the gradient", z: "x^2 + 2*y^2", xDomain: [-2, 2], yDomain: [-2, 2], view: "contour", points: [{ x: 1, y: 1, label: "(1, 1)" }], gradients_at: [{ x: 1, y: 1 }], tangent_plane_at: null },
    { type: "vector_field", title: "F = (−y, x) circulates", fx: "-y", fy: "x", xDomain: [-3, 3], yDomain: [-3, 3], curve: { x: "2*cos(t)", y: "2*sin(t)", t: [0, 6.283] } },
  ],
});

export default function DevPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto w-full max-w-[480px] p-4">
      <TutorBlocks blocks={advanced.blocks} />
      <hr className="my-8" />
      <TutorBlocks blocks={sample.blocks} />
    </main>
  );
}
