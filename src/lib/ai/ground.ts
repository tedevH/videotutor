import { GoogleGenAI, PartMediaResolutionLevel, ThinkingLevel } from "@google/genai";
import { withRetry } from "@/lib/ai/retry";
import type { Usage } from "@/lib/ai/tutor";
import type { Block, FrameAnnotation } from "@/lib/tutor/schema";

type Box = [number, number, number, number];
type FrameBlock = Extract<Block, { type: "frame" }>;

const FOCUS_PADDING = 90;
const MIN_FOCUS_SIZE = 380;

/**
 * Turns the tutor's named targets ("the tallest rectangle on the right") into coordinates with one
 * detection call. Gemini boxes objects accurately when detection is the only task.
 */
export async function groundFrameBlock(
  block: FrameBlock,
  frameJpeg: string,
  model: string,
): Promise<{ block: FrameBlock; usage: Usage }> {
  const targets = [...new Set([...block.annotations.map((a) => a.target), block.focus].filter((t): t is string => !!t))];
  if (!targets.length) return { block, usage: { inputTokens: 0, outputTokens: 0 } };

  const res = await withRetry(() =>
    new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! }).models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: { mimeType: "image/jpeg", data: frameJpeg },
              mediaResolution: { level: PartMediaResolutionLevel.MEDIA_RESOLUTION_HIGH },
            },
            {
              text: `Detect each target in the image. Return a JSON array with one entry per target: [{"target": index, "box_2d": [ymin, xmin, ymax, xmax]}], normalized to 0-1000. Box the target tightly. Omit a target only if it is not visible.

Targets:
${targets.map((t, i) => `${i}: ${t}`).join("\n")}`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        temperature: 0,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    }),
  );

  const boxes = new Map<string, Box>();
  try {
    const found = JSON.parse(res.text ?? "[]") as { target: number; box_2d?: number[]; box?: number[] }[];
    for (const f of found) {
      const b = f.box_2d ?? f.box;
      if (b?.length === 4 && targets[f.target]) boxes.set(targets[f.target], normalize(b as Box));
    }
  } catch {
    // Leave annotations unplaced; the renderer skips anything without coordinates.
  }

  const annotations = dedupeLabels(block.annotations.flatMap((a) => place(a, boxes.get(a.target))));
  const focusBoxes = block.focus && boxes.has(block.focus) ? [boxes.get(block.focus)!] : [];
  // Crop around everything that gets drawn, including arrow tails and labels.
  const drawn = annotations.flatMap((a): Box[] =>
    [a.box_2d, a.from, a.to, a.point].filter(Boolean).map((v) => (v!.length === 4 ? (v as Box) : [v![0], v![1], v![0], v![1]])),
  );
  const crop = cropAround([...focusBoxes, ...drawn]);

  return {
    block: { ...block, annotations, crop },
    usage: {
      inputTokens: res.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: (res.usageMetadata?.candidatesTokenCount ?? 0) + (res.usageMetadata?.thoughtsTokenCount ?? 0),
    },
  };
}

function normalize([a, b, c, d]: Box): Box {
  const clamp = (v: number) => Math.min(1000, Math.max(0, v));
  return [clamp(Math.min(a, c)), clamp(Math.min(b, d)), clamp(Math.max(a, c)), clamp(Math.max(b, d))];
}

/** Converts a named annotation into drawable coordinates next to its detected box. */
function place(a: FrameAnnotation, box: Box | undefined): FrameAnnotation[] {
  if (!box) return [];
  const [ymin, xmin, ymax, xmax] = box;
  const cy = (ymin + ymax) / 2;
  const cx = (xmin + xmax) / 2;

  switch (a.kind) {
    case "circle":
    case "box":
    case "underline":
      return [{ ...a, box_2d: box }];
    case "label": {
      // Above the target when there's room, otherwise below.
      const y = ymin > 90 ? ymin - 30 : Math.min(980, ymax + 60);
      return [{ ...a, point: [y, cx] }];
    }
    case "arrow": {
      // Come in from the side of the frame with the most empty space, stopping at the box edge.
      const dx = cx < 500 ? 1 : -1;
      const dy = cy < 500 ? 1 : -1;
      const from: [number, number] = [clamp(cy + dy * 170, 40, 960), clamp(cx + dx * 200, 40, 960)];
      const to: [number, number] = [cy + dy * ((ymax - ymin) / 2 + 12), cx + dx * ((xmax - xmin) / 2 + 12)];
      const arrow: FrameAnnotation = { ...a, from, to };
      if (!a.text) return [arrow];
      const labelY = from[0] + (dy > 0 ? 45 : -20);
      return [arrow, { ...a, kind: "label", point: [clamp(labelY, 40, 980), from[1]] }];
    }
  }
}

/** Models often give an arrow a label and also add the same text as a separate label. */
function dedupeLabels(annotations: FrameAnnotation[]) {
  const seen = new Set<string>();
  return annotations.filter((a) => {
    if (a.kind !== "label" || !a.text) return true;
    const key = `${a.target}|${a.text.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Zooms to the annotated region with some margin; null when that's most of the frame anyway. */
function cropAround(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  let [ymin, xmin, ymax, xmax] = [
    Math.min(...boxes.map((b) => b[0])) - FOCUS_PADDING,
    Math.min(...boxes.map((b) => b[1])) - FOCUS_PADDING,
    Math.max(...boxes.map((b) => b[2])) + FOCUS_PADDING,
    Math.max(...boxes.map((b) => b[3])) + FOCUS_PADDING,
  ];
  const grow = (lo: number, hi: number): [number, number] => {
    const missing = MIN_FOCUS_SIZE - (hi - lo);
    return missing > 0 ? [lo - missing / 2, hi + missing / 2] : [lo, hi];
  };
  [ymin, ymax] = grow(ymin, ymax);
  [xmin, xmax] = grow(xmin, xmax);
  const box = normalize([ymin, xmin, ymax, xmax]);
  const area = ((box[2] - box[0]) * (box[3] - box[1])) / 1_000_000;
  return area > 0.7 ? null : box;
}
