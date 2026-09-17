"use client";

import { useEffect, useRef, useState } from "react";
import { MarkdownBlock } from "./markdown-block";

type SmilesModule = {
  Parser: { parse: (smiles: string, options?: object) => unknown };
  SvgDrawer: new (options: object) => { draw: (tree: unknown, target: Element, theme?: string) => SVGSVGElement };
};

async function loadSmiles(): Promise<SmilesModule> {
  const mod = (await import("smiles-drawer")) as unknown as { default: SmilesModule };
  return mod.default;
}

/** Draws one structure from SMILES. Returns false (and draws nothing) when the SMILES is invalid. */
function Structure({ smiles, width = 320, height = 220, onError }: { smiles: string; width?: number; height?: number; onError?: () => void }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    let cancelled = false;
    loadSmiles().then((S) => {
      if (cancelled || !ref.current) return;
      try {
        ref.current.innerHTML = "";
        const tree = S.Parser.parse(smiles, {});
        new S.SvgDrawer({ width, height, bondThickness: 1.2, fontSizeLarge: 11, fontSizeSmall: 8, padding: 12 }).draw(tree, ref.current, "light");
      } catch {
        onError?.();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [smiles, width, height, onError]);
  return <svg ref={ref} width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="max-w-full" role="img" aria-label={`Structure ${smiles}`} />;
}

export function MoleculeBlock({ title, smiles, name, notes }: { title: string; smiles: string; name: string; notes: string[] }) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-white">
      {title && <figcaption className="border-b border-line px-3 py-2 text-sm font-semibold">{title}</figcaption>}
      <div className="flex justify-center p-2">{failed ? <p className="p-4 text-sm text-muted">Couldn&apos;t draw {smiles}</p> : <Structure smiles={smiles} onError={() => setFailed(true)} />}</div>
      <div className="border-t border-line px-3 py-2 text-sm">
        {name && <p className="font-medium capitalize">{name}</p>}
        {notes.map((n, i) => (
          <MarkdownBlock key={i} md={`• ${n}`} className="text-sm text-muted [&_p]:my-0" />
        ))}
      </div>
    </figure>
  );
}

export function ReactionBlock({
  title,
  reactants,
  products,
  conditions,
  notes,
}: {
  title: string;
  reactants: string[];
  products: string[];
  conditions: string;
  notes: string[];
}) {
  const side = (list: string[], key: string) =>
    list.map((s, i) => (
      <div key={`${key}-${i}`} className="flex items-center">
        {i > 0 && <span className="px-1 text-xl text-muted">+</span>}
        {/* Tiny species (ions, single atoms) get a small box; the drawer scales structures to fill it. */}
        {atomCount(s) <= 2 ? <Structure smiles={s} width={70} height={60} /> : <Structure smiles={s} width={170} height={140} />}
      </div>
    ));
  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-white">
      {title && <figcaption className="border-b border-line px-3 py-2 text-sm font-semibold">{title}</figcaption>}
      <div className="flex flex-wrap items-center justify-center gap-1 overflow-x-auto p-2">
        {side(reactants, "r")}
        <div className="flex min-w-[90px] flex-col items-center px-2">
          <span className="text-center text-xs text-muted">{conditions}</span>
          <svg width="80" height="16" viewBox="0 0 80 16" aria-hidden>
            <path d="M2 8 H72 M64 2 L74 8 L64 14" fill="none" stroke="#1c1b19" strokeWidth="2" />
          </svg>
        </div>
        {side(products, "p")}
      </div>
      {notes.length > 0 && (
        <div className="border-t border-line px-3 py-2">
          {notes.map((n, i) => (
            <MarkdownBlock key={i} md={`• ${n}`} className="text-sm text-muted [&_p]:my-0" />
          ))}
        </div>
      )}
    </figure>
  );
}

/** Rough heavy-atom count from SMILES (bracket atoms count once). */
function atomCount(smiles: string) {
  const withoutBrackets = smiles.replace(/\[[^\]]*\]/g, "X");
  return (withoutBrackets.match(/Cl|Br|[BCNOPSFIX]|[bcnops]/g) ?? []).length;
}
