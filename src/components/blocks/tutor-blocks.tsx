import type { Block } from "@/lib/tutor/schema";
import { CheckQuestion } from "./check-question";
import { FlowBlock } from "./flow-block";
import { MarkdownBlock } from "./markdown-block";
import { PlotBlock } from "./plot-block";
import { SketchDiagram } from "./sketch-diagram";

export function TutorBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-3">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "text":
            return <MarkdownBlock key={i} md={b.md} />;
          case "diagram":
            return <SketchDiagram key={i} title={b.title} elements={b.elements} steps={b.steps} />;
          case "flow":
            return <FlowBlock key={i} title={b.title} mermaid={b.mermaid} />;
          case "plot":
            return <PlotBlock key={i} title={b.title} functions={b.functions} xDomain={b.xDomain} yDomain={b.yDomain} />;
          case "check_question":
            return <CheckQuestion key={i} question={b.question} answer={b.answer} />;
        }
      })}
    </div>
  );
}
