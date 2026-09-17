"use client";

import { useState } from "react";

const CARDS = [
  { subject: "Calculus", ask: "why does the chain rule multiply?", answer: "Rates stack. If u changes 3× as fast as x, and y changes 2× as fast as u, then y changes 6× as fast as x." },
  { subject: "Organic chemistry", ask: "where does the arrow push from?", answer: "Arrows always start at electrons, a lone pair or a bond, and point to the atom that accepts them." },
  { subject: "Physics", ask: "why is normal force not mg here?", answer: "N only cancels the part of gravity pressing into the surface. On a ramp tilted θ, that's mg cos θ." },
  { subject: "Biology", ask: "which phase does the DNA copy in?", answer: "S phase, during interphase, before mitosis starts. Mitosis just separates the copies." },
  { subject: "Statistics", ask: "what is a p-value actually saying?", answer: "If there were truly no effect, how often you'd see data this extreme. It isn't the chance the null is true." },
  { subject: "Computer science", ask: "why is this loop O(n log n)?", answer: "The outer loop runs n times, and the inner one halves its range each step, so about log n steps each time." },
  { subject: "Economics", ask: "why does the curve shift left?", answer: "Something other than price changed, like income or costs, so less is bought or sold at every price." },
  { subject: "Linear algebra", ask: "what does the determinant measure?", answer: "How much the transformation scales area. A negative sign means it also flips orientation." },
  { subject: "Psychology", ask: "how is this different from conditioning?", answer: "Conditioning learns from your own rewards and punishments. Observational learning copies what others do." },
  { subject: "History", ask: "how did that treaty lead to the war?", answer: "Versailles' reparations and lost territory fueled resentment in Germany that extremists turned into support." },
  { subject: "Accounting", ask: "why is this a debit?", answer: "Assets and expenses go up with debits. Buying supplies raises an asset, so Supplies is debited." },
  { subject: "Music theory", ask: "why does that chord resolve there?", answer: "The V chord's leading tone sits a half step under the tonic and pulls up into it, so V → I sounds finished." },
];

const TILTS = ["-rotate-2", "rotate-1", "-rotate-1", "rotate-2", "rotate-1", "-rotate-2", "rotate-2", "-rotate-1", "-rotate-1", "rotate-2", "-rotate-2", "rotate-1"];

/** Subject examples as index cards: the student's question on the front, how Lumo answers on the back. */
export function SubjectFlashcards() {
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const toggle = (i: number) =>
    setFlipped((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div>
      <ul className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map((card, i) => {
          const isFlipped = flipped.has(i);
          return (
            <li key={card.subject} className={`${TILTS[i]} transition-transform duration-300 hover:rotate-0 hover:-translate-y-1`} style={{ perspective: "1200px" }}>
              <button
                onClick={() => toggle(i)}
                aria-pressed={isFlipped}
                aria-label={`${card.subject}: ${isFlipped ? card.answer : card.ask}. ${isFlipped ? "Show question" : "Show Lumo's answer"}`}
                className="relative block h-48 w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-pen focus-visible:ring-offset-4 focus-visible:ring-offset-paper"
                style={{ transformStyle: "preserve-3d", transition: "transform 550ms cubic-bezier(.2,.7,.2,1)", transform: isFlipped ? "rotateY(180deg)" : "none" }}
              >
                {/* front: ruled index card */}
                <span
                  className="index-card absolute inset-0 flex flex-col rounded-md p-5 pl-9 shadow-[0_1px_1px_rgba(0,0,0,0.08),0_10px_18px_-12px_rgba(0,0,0,0.35)]"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-pen">{card.subject}</span>
                  <span className="mt-4 text-[19px] font-medium leading-[28px] text-ink">&ldquo;{card.ask}&rdquo;</span>
                  <span className="mt-auto text-xs text-ink/45">tap to flip ↻</span>
                </span>
                {/* back: Lumo's answer */}
                <span
                  className="absolute inset-0 flex flex-col rounded-md bg-[#fffdf6] p-5 shadow-[0_1px_1px_rgba(0,0,0,0.08),0_10px_18px_-12px_rgba(0,0,0,0.35)]"
                  style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                >
                  <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/55">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-ink text-[10px] text-white">L</span>
                    Lumo
                  </span>
                  <span className="mt-3 text-[15px] leading-relaxed text-ink/85">{card.answer}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-8 text-center text-sm text-muted">
        Flip a card. In the app, Lumo answers at the exact moment in your lecture, with a diagram when it helps.
      </p>
    </div>
  );
}
