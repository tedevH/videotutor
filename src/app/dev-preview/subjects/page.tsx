import { TutorBlocks } from "@/components/blocks/tutor-blocks";
import { tutorResponse } from "@/lib/tutor/schema";

const sample = tutorResponse.parse({
  blocks: [
    { type: "molecule", title: "Aspirin", smiles: "CC(=O)OC1=CC=CC=C1C(=O)O", name: "acetylsalicylic acid", notes: ["ester group on the left", "carboxylic acid on the right"] },
    { type: "reaction", title: "SN2: hydroxide attacks bromomethane", reactants: ["CBr", "[OH-]"], products: ["CO", "[Br-]"], conditions: "one step, backside attack", notes: ["rate = k[CH3Br][OH-]"] },
    {
      type: "free_body",
      title: "Block at rest on a 30° incline",
      object: "box",
      incline_deg: 30,
      axes: "incline",
      forces: [
        { label: "mg", kind: "gravity", magnitude: 10, angle_deg: 0, color: "red", show_components: true },
        { label: "N", kind: "normal", magnitude: 8.66, angle_deg: 0, color: "blue", show_components: false },
        { label: "f", kind: "friction_up_slope", magnitude: 5, angle_deg: 0, color: "green", show_components: false },
      ],
    },
    {
      type: "data_structure",
      title: "Binary search for 7",
      kind: "array",
      frames: [
        { caption: "Check the middle element (5).", items: ["1", "3", "5", "7", "9", "11"], highlight: [2], pointers: [{ label: "lo", index: 0 }, { label: "mid", index: 2 }, { label: "hi", index: 5 }] },
        { caption: "7 > 5, so search the right half.", items: ["1", "3", "5", "7", "9", "11"], highlight: [4], pointers: [{ label: "lo", index: 3 }, { label: "mid", index: 4 }, { label: "hi", index: 5 }] },
        { caption: "7 < 9: move hi left. Found 7 at index 3.", items: ["1", "3", "5", "7", "9", "11"], highlight: [3], pointers: [{ label: "lo/mid/hi", index: 3 }] },
      ],
    },
    {
      type: "data_structure",
      title: "Call stack for fact(3)",
      kind: "stack",
      frames: [{ caption: "Each call waits on the one above it.", items: ["main()", "fact(3)", "fact(2)", "fact(1)"], highlight: [] }],
    },
    {
      type: "data_structure",
      title: "BST insert 6",
      kind: "tree",
      frames: [
        {
          caption: "6 < 8 go left, 6 > 3 go right, 6 goes left of 7? No: 6 < 7, insert as left child of 7.",
          tree: [
            { id: "a", value: "8", parent: null },
            { id: "b", value: "3", parent: "a" },
            { id: "c", value: "10", parent: "a" },
            { id: "d", value: "1", parent: "b" },
            { id: "e", value: "7", parent: "b" },
            { id: "f", value: "6", parent: "e" },
            { id: "g", value: "14", parent: "c" },
          ],
          highlight_ids: ["a", "b", "e", "f"],
        },
      ],
    },
    {
      type: "data_structure",
      title: "Dijkstra from A",
      kind: "graph",
      directed: false,
      frames: [
        {
          caption: "Shortest path A → D goes through B.",
          tree: [{ id: "A", value: "A", parent: null }, { id: "B", value: "B", parent: null }, { id: "C", value: "C", parent: null }, { id: "D", value: "D", parent: null }],
          edges: [{ from: "A", to: "B", label: "1" }, { from: "B", to: "D", label: "2" }, { from: "A", to: "C", label: "4" }, { from: "C", to: "D", label: "1" }],
          highlight_ids: ["A", "B", "D"],
        },
      ],
    },
  ],
});

export default function SubjectsPreview() {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <main className="mx-auto grid max-w-3xl gap-6 p-6">
      <TutorBlocks blocks={sample.blocks} />
    </main>
  );
}
