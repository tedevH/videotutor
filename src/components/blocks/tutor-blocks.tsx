import { Whiteboard } from "@/components/board/whiteboard";
import type { Block } from "@/lib/tutor/schema";
import { CheckQuestion } from "./check-question";
import { FlowBlock } from "./flow-block";
import { FrameAnnotation } from "./frame-annotation";
import { MarkdownBlock } from "./markdown-block";
import { Plot3D } from "./plot-3d";
import { PlotBlock } from "./plot-block";
import { SketchDiagram } from "./sketch-diagram";
import { StepsBlock } from "./steps-block";
import { Transform2D } from "./transform-2d";
import { VectorField } from "./vector-field";

export function TutorBlocks({
  blocks,
  frameUrl,
  onAskAboutDrawing,
}: {
  blocks: Block[];
  frameUrl?: string | null;
  onAskAboutDrawing?: (png: string) => void;
}) {
  return (
    <div className="space-y-3">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "text":
            return <MarkdownBlock key={i} md={b.md} />;
          case "frame":
            return <FrameAnnotation key={i} frameUrl={frameUrl} title={b.title} crop={b.crop} annotations={b.annotations} steps={b.steps} />;
          case "diagram":
            return <SketchDiagram key={i} title={b.title} elements={b.elements} steps={b.steps} />;
          case "flow":
            return <FlowBlock key={i} title={b.title} mermaid={b.mermaid} />;
          case "plot":
            return <PlotBlock key={i} {...b} />;
          case "check_question":
            return <CheckQuestion key={i} question={b.question} answer={b.answer} />;
          case "board":
            return <Whiteboard key={i} title={b.title} ops={b.ops} steps={b.steps} allowDrawing={!!onAskAboutDrawing} onAskAboutDrawing={onAskAboutDrawing} />;
          case "steps":
            return <StepsBlock key={i} title={b.title} steps={b.steps} />;
          case "transform2d":
            return <Transform2D key={i} title={b.title} matrix={b.matrix} vectors={b.vectors} showEigenvectors={b.show_eigenvectors} />;
          case "plot3d":
            return (
              <Plot3D
                key={i}
                title={b.title}
                z={b.z}
                xDomain={b.xDomain}
                yDomain={b.yDomain}
                view={b.view}
                points={b.points}
                gradientsAt={b.gradients_at}
                tangentPlaneAt={b.tangent_plane_at}
              />
            );
          case "vector_field":
            return <VectorField key={i} title={b.title} fx={b.fx} fy={b.fy} xDomain={b.xDomain} yDomain={b.yDomain} curve={b.curve} />;
        }
      })}
    </div>
  );
}
