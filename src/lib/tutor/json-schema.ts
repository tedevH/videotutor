/**
 * JSON Schema for Gemini structured output. Constrained decoding guarantees valid JSON
 * (LaTeX backslashes get escaped correctly); Zod still validates the details.
 */
const num = { type: "number" };
const str = { type: "string" };
const pair = { type: "array", items: num, minItems: 2, maxItems: 2 };
const steps = {
  type: "array",
  items: { type: "object", properties: { step: { type: "integer" }, narration: str }, required: ["step", "narration"] },
};
const obj = (properties: Record<string, unknown>, required: string[]) => ({ type: "object", properties, required });

const frameAnnotation = obj(
  {
    kind: { type: "string", enum: ["circle", "box", "underline", "arrow", "label"] },
    step: { type: "integer" },
    color: { type: "string", enum: ["red", "yellow", "blue", "green", "orange", "purple", "white"] },
    target: str,
    text: str,
  },
  ["kind", "step", "color", "target"],
);

const diagramElement = obj(
  {
    kind: { type: "string", enum: ["rect", "ellipse", "line", "arrow", "text", "highlight"] },
    step: { type: "integer" },
    color: { type: "string", enum: ["ink", "red", "blue", "green", "orange", "purple"] },
    x: num, y: num, w: num, h: num, cx: num, cy: num, rx: num, ry: num, r: num,
    points: { type: "array", items: pair },
    from: pair,
    to: pair,
    label: str,
    text: str,
    size: { type: "string", enum: ["sm", "md", "lg"] },
    dashed: { type: "boolean" },
  },
  ["kind", "step", "color"],
);

const block = {
  anyOf: [
    obj({ type: { type: "string", enum: ["text"] }, md: str }, ["type", "md"]),
    obj(
      { type: { type: "string", enum: ["frame"] }, title: str, focus: { type: ["string", "null"] }, annotations: { type: "array", items: frameAnnotation }, steps },
      ["type", "title", "annotations", "steps"],
    ),
    obj(
      {
        type: { type: "string", enum: ["plot"] },
        title: str,
        functions: { type: "array", items: obj({ fn: str, label: str }, ["fn"]) },
        xDomain: pair,
        yDomain: pair,
        shade: { type: "array", items: obj({ fn: str, from: num, to: num }, ["fn", "from", "to"]) },
        points: { type: "array", items: obj({ x: num, y: num, label: str }, ["x", "y"]) },
        vlines: { type: "array", items: obj({ x: num, label: str }, ["x"]) },
      },
      ["type", "title", "functions", "xDomain"],
    ),
    obj({ type: { type: "string", enum: ["flow"] }, title: str, mermaid: str }, ["type", "title", "mermaid"]),
    obj(
      { type: { type: "string", enum: ["diagram"] }, title: str, elements: { type: "array", items: diagramElement }, steps },
      ["type", "title", "elements", "steps"],
    ),
    obj({ type: { type: "string", enum: ["check_question"] }, question: str, answer: str }, ["type", "question", "answer"]),
  ],
};

export const tutorJsonSchema = obj(
  {
    plan: obj(
      {
        about_screen: { type: "boolean" },
        question_type: { type: "string", enum: ["conceptual", "procedural", "factual", "visual", "follow_up", "off_topic"] },
        visual: { type: "string", enum: ["none", "frame", "plot", "diagram", "flow"] },
        why: str,
      },
      ["about_screen", "question_type", "visual", "why"],
    ),
    misconception: str,
    blocks: { type: "array", items: block },
    rewatch_from: { type: ["number", "null"] },
  },
  ["plan", "misconception", "blocks", "rewatch_from"],
);
