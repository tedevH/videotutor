import { Reel } from "./reel";

/** The demo video's stage, recorded frame by frame by a script. Dev only. */
export default function ReelPage() {
  if (process.env.NODE_ENV === "production") return null;
  return <Reel />;
}
