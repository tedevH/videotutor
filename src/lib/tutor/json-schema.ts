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
    obj(
      {
        type: { type: "string", enum: ["board"] },
        title: str,
        ops: {
          type: "array",
          items: obj(
            {
              op: { type: "string", enum: ["write", "draw", "graph", "highlight", "erase"] },
              id: str,
              step: { type: "integer" },
              x: num, y: num, w: num, h: num,
              text: str,
              size: { type: "string", enum: ["sm", "md", "lg"] },
              color: { type: "string", enum: ["ink", "red", "blue", "green", "orange", "purple"] },
              shape: { type: "string", enum: ["line", "arrow", "rect", "ellipse", "polyline"] },
              points: { type: "array", items: pair },
              dashed: { type: "boolean" },
              label: str,
              fn: str,
              xDomain: pair,
              yDomain: { anyOf: [pair, { type: "null" }] },
              shade: { anyOf: [pair, { type: "null" }] },
              marks: { type: "array", items: obj({ x: num, y: num, label: str }, ["x", "y"]) },
              target: str,
              ids: { type: "array", items: str },
            },
            ["op", "step"],
          ),
        },
        steps,
      },
      ["type", "title", "ops", "steps"],
    ),
    obj({ type: { type: "string", enum: ["molecule"] }, title: str, smiles: str, name: str, notes: { type: "array", items: str } }, ["type", "title", "smiles", "name"]),
    obj(
      {
        type: { type: "string", enum: ["reaction"] },
        title: str,
        reactants: { type: "array", items: str },
        products: { type: "array", items: str },
        conditions: str,
        notes: { type: "array", items: str },
      },
      ["type", "title", "reactants", "products", "conditions"],
    ),
    obj(
      {
        type: { type: "string", enum: ["free_body"] },
        title: str,
        object: { type: "string", enum: ["box", "ball", "point"] },
        incline_deg: { type: ["number", "null"] },
        forces: {
          type: "array",
          items: obj(
            {
              label: str,
              kind: { type: "string", enum: ["gravity", "normal", "friction_up_slope", "friction_down_slope", "tension", "applied", "custom"] },
              magnitude: num,
              angle_deg: num,
              color: { type: "string", enum: ["red", "blue", "green", "orange", "purple", "ink"] },
              show_components: { type: "boolean" },
            },
            ["label", "kind", "magnitude", "angle_deg", "color"],
          ),
        },
        axes: { type: "string", enum: ["standard", "incline"] },
      },
      ["type", "title", "object", "incline_deg", "forces", "axes"],
    ),
    obj(
      {
        type: { type: "string", enum: ["data_structure"] },
        title: str,
        kind: { type: "string", enum: ["array", "linked_list", "tree", "graph", "stack"] },
        directed: { type: "boolean" },
        frames: {
          type: "array",
          items: obj(
            {
              caption: str,
              items: { type: "array", items: str },
              highlight: { type: "array", items: num },
              pointers: { type: "array", items: obj({ label: str, index: num }, ["label", "index"]) },
              tree: { type: "array", items: obj({ id: str, value: str, parent: { type: ["string", "null"] } }, ["id", "value", "parent"]) },
              edges: { type: "array", items: obj({ from: str, to: str, label: str }, ["from", "to"]) },
              highlight_ids: { type: "array", items: str },
            },
            ["caption"],
          ),
        },
      },
      ["type", "title", "kind", "frames"],
    ),
    obj(
      { type: { type: "string", enum: ["steps"] }, title: str, steps: { type: "array", items: obj({ math: str, note: str }, ["math", "note"]) } },
      ["type", "title", "steps"],
    ),
    obj(
      {
        type: { type: "string", enum: ["transform2d"] },
        title: str,
        matrix: { type: "array", items: pair, minItems: 2, maxItems: 2 },
        vectors: { type: "array", items: obj({ x: num, y: num, label: str }, ["x", "y"]) },
        show_eigenvectors: { type: "boolean" },
      },
      ["type", "title", "matrix"],
    ),
    obj(
      {
        type: { type: "string", enum: ["plot3d"] },
        title: str,
        z: str,
        xDomain: pair,
        yDomain: pair,
        view: { type: "string", enum: ["surface", "contour"] },
        points: { type: "array", items: obj({ x: num, y: num, label: str }, ["x", "y"]) },
        gradients_at: { type: "array", items: obj({ x: num, y: num }, ["x", "y"]) },
        tangent_plane_at: { anyOf: [obj({ x: num, y: num }, ["x", "y"]), { type: "null" }] },
      },
      ["type", "title", "z", "xDomain", "yDomain", "view"],
    ),
    obj(
      {
        type: { type: "string", enum: ["vector_field"] },
        title: str,
        fx: str,
        fy: str,
        xDomain: pair,
        yDomain: pair,
        curve: { anyOf: [obj({ x: str, y: str, t: pair }, ["x", "y", "t"]), { type: "null" }] },
      },
      ["type", "title", "fx", "fy", "xDomain", "yDomain"],
    ),
  ],
};

export const momentJsonSchema = obj(
  {
    on_screen: str,
    last_30_seconds: str,
    subject: str,
    level: { type: "string", enum: ["intro", "intermediate", "advanced"] },
    needs_computation: { type: "boolean" },
    needs_proof_or_derivation: { type: "boolean" },
  },
  ["on_screen", "last_30_seconds", "subject", "level", "needs_computation", "needs_proof_or_derivation"],
);

export const tutorJsonSchema = obj(
  {
    plan: obj(
      {
        about_screen: { type: "boolean" },
        question_type: { type: "string", enum: ["conceptual", "procedural", "factual", "visual", "follow_up", "off_topic"] },
        visual: { type: "string", enum: ["none", "frame", "plot", "diagram", "flow", "steps", "transform2d", "plot3d", "vector_field", "board", "molecule", "reaction", "free_body", "data_structure"] },
        why: str,
      },
      ["about_screen", "question_type", "visual", "why"],
    ),
    move: { type: "string", enum: ["question", "hint", "example", "explain", "check", "practice", "wrap_up"] },
    awaiting_student: { type: "boolean" },
    resolved: { type: "boolean" },
    assessment: obj(
      { result: { type: "string", enum: ["correct", "partial", "incorrect", "not_applicable"] }, diagnosis: str },
      ["result", "diagnosis"],
    ),
    observations: {
      type: "array",
      items: obj(
        {
          concept: str,
          subject: str,
          signal: { type: "string", enum: ["asked", "confused", "understood", "misconception"] },
          misconception_key: str,
          misconception: str,
        },
        ["concept", "subject", "signal"],
      ),
    },
    misconception: str,
    blocks: { type: "array", items: block },
    rewatch_from: { type: ["number", "null"] },
  },
  ["plan", "move", "awaiting_student", "resolved", "assessment", "observations", "misconception", "blocks", "rewatch_from"],
);
