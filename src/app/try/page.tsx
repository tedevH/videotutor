import { TryStarter } from "./try-starter";

export const metadata = {
  title: "Try Lumo",
  description: "Ask Lumo about any problem. No account needed.",
};

/** The no-signup entrance: a guest session and a whiteboard, in one click from the landing page. */
export default function TryPage() {
  return <TryStarter />;
}
