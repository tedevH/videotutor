const INK = "#1c1b19";
const PEN = "#d9480f";
const BLUE = "#1c64d6";

function Card({ question, at, lecture, children, note }: { question: string; at: string; lecture: string; children: React.ReactNode; note: React.ReactNode }) {
  return (
    <figure className="flex flex-col rounded-2xl border border-ink/12 bg-white p-5 shadow-[0_1px_0_rgba(28,27,25,0.06)] sm:p-6">
      <div className="flex items-baseline justify-between gap-3 text-xs text-muted">
        <span className="truncate">{lecture}</span>
        <span className="shrink-0 font-medium tabular-nums text-pen">asked @ {at}</span>
      </div>
      <p className="mt-2 text-lg font-semibold leading-snug">&ldquo;{question}&rdquo;</p>
      <div className="mt-4 rounded-xl border border-dashed border-ink/15 bg-[#fffdf8] p-2">{children}</div>
      <figcaption className="mt-4 text-[15px] leading-relaxed text-ink/80">{note}</figcaption>
    </figure>
  );
}

/** Derivative as the limit of secant slopes on f(x) = 0.08x² + 0.4, drawn with real coordinates. */
function TangentDiagram() {
  // math → svg: origin (50, 250), 40px per x unit, 30px per y unit
  const X = (x: number) => 50 + x * 40;
  const Y = (y: number) => 250 - y * 30;
  const f = (x: number) => 0.08 * x * x + 0.4;
  const curve = Array.from({ length: 61 }, (_, i) => {
    const x = (i / 60) * 8.4;
    return `${i ? "L" : "M"}${X(x).toFixed(1)},${Y(f(x)).toFixed(1)}`;
  }).join(" ");
  const a = 2;
  const b = 6;
  const slopeTangent = 0.16 * a;
  const slopeSecant = (f(b) - f(a)) / (b - a);
  const line = (m: number, from: number, to: number) => `M${X(from)},${Y(f(a) + m * (from - a))} L${X(to)},${Y(f(a) + m * (to - a))}`;

  return (
    <svg viewBox="0 0 400 280" className="block w-full" role="img" aria-label="A curve with a dashed secant line through two points and the tangent line at x equals a">
      <path d={`M${X(0)},266 L${X(0)},20 M34,${Y(0)} L390,${Y(0)}`} stroke={INK} strokeWidth="1.5" opacity="0.5" fill="none" />
      <path d={curve} stroke={INK} strokeWidth="2.5" fill="none" />
      <path d={line(slopeSecant, 0.9, 8)} stroke={BLUE} strokeWidth="2" strokeDasharray="6 5" fill="none" />
      <path d={line(slopeTangent, 0, 8.4)} stroke={PEN} strokeWidth="2.5" fill="none" />
      {/* rise and run of the secant */}
      <path d={`M${X(a)},${Y(f(a))} L${X(b)},${Y(f(a))} L${X(b)},${Y(f(b))}`} stroke={BLUE} strokeWidth="1.5" fill="none" opacity="0.8" />
      <text x={(X(a) + X(b)) / 2} y={Y(f(a)) + 22} textAnchor="middle" fontSize="15" fill={BLUE}>Δx</text>
      <text x={X(b) + 8} y={(Y(f(a)) + Y(f(b))) / 2 + 12} fontSize="15" fill={BLUE}>Δy</text>
      <circle cx={X(a)} cy={Y(f(a))} r="4.5" fill={PEN} />
      <circle cx={X(b)} cy={Y(f(b))} r="4" fill={BLUE} />
      <text x={X(a)} y={Y(0) + 22} textAnchor="middle" fontSize="15" fill={PEN}>a</text>
      <line x1={X(a)} y1={Y(0)} x2={X(a)} y2={Y(f(a))} stroke={PEN} strokeWidth="1" strokeDasharray="3 4" />
      <text x={388} y={Y(0) + 22} textAnchor="end" fontSize="18" fill={INK} opacity="0.6">x</text>
      {/* legend in the empty upper-left */}
      <g fontSize="15">
        <line x1="70" y1="38" x2="100" y2="38" stroke={BLUE} strokeWidth="2" strokeDasharray="6 5" />
        <text x="108" y="43" fill={BLUE}>secant: Δy / Δx</text>
        <line x1="70" y1="66" x2="100" y2="66" stroke={PEN} strokeWidth="2.5" />
        <text x="108" y="71" fill={PEN}>tangent: slope f′(a)</text>
      </g>
    </svg>
  );
}

/** Water: bent geometry, 104.5° H–O–H angle, two lone pairs, partial charges and net dipole. */
function WaterDiagram() {
  const O = { x: 200, y: 118 };
  const bond = 112;
  const half = (104.5 / 2) * (Math.PI / 180);
  const H1 = { x: O.x - bond * Math.sin(half), y: O.y + bond * Math.cos(half) };
  const H2 = { x: O.x + bond * Math.sin(half), y: O.y + bond * Math.cos(half) };
  // angle arc between the two bonds
  const r = 38;
  const arcStart = { x: O.x - r * Math.sin(half), y: O.y + r * Math.cos(half) };
  const arcEnd = { x: O.x + r * Math.sin(half), y: O.y + r * Math.cos(half) };
  const lonePair = (deg: number) => {
    const t = (deg * Math.PI) / 180;
    const cx = O.x + 40 * Math.sin(t);
    const cy = O.y - 40 * Math.cos(t);
    const px = 5 * Math.cos(t);
    const py = 5 * Math.sin(t);
    return (
      <g key={deg}>
        <circle cx={cx - px} cy={cy - py} r="3.2" fill={INK} />
        <circle cx={cx + px} cy={cy + py} r="3.2" fill={INK} />
      </g>
    );
  };

  return (
    <svg viewBox="0 0 400 280" className="block w-full" role="img" aria-label="Water molecule: bent shape with a 104.5 degree angle, two lone pairs on oxygen, partial charges, and a dipole pointing toward oxygen">
      <line x1={O.x} y1={O.y} x2={H1.x} y2={H1.y} stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <line x1={O.x} y1={O.y} x2={H2.x} y2={H2.y} stroke={INK} strokeWidth="5" strokeLinecap="round" />
      {[-52, 52].map(lonePair)}
      <path d={`M${arcStart.x},${arcStart.y} A${r},${r} 0 0 0 ${arcEnd.x},${arcEnd.y}`} stroke={PEN} strokeWidth="2" fill="none" />
      <text x={O.x} y={O.y + r + 26} textAnchor="middle" fontSize="15" fill={PEN}>104.5°</text>

      <circle cx={O.x} cy={O.y} r="25" fill="#fff" stroke={INK} strokeWidth="2.5" />
      <text x={O.x} y={O.y + 8} textAnchor="middle" fontSize="24" fontWeight="600" fill={INK}>O</text>
      {[H1, H2].map((h, i) => (
        <g key={i}>
          <circle cx={h.x} cy={h.y} r="18" fill="#fff" stroke={INK} strokeWidth="2.5" />
          <text x={h.x} y={h.y + 7} textAnchor="middle" fontSize="15" fontWeight="600" fill={INK}>H</text>
          <text x={h.x + (i ? 24 : -24)} y={h.y + 34} textAnchor="middle" fontSize="15" fill={BLUE}>δ+</text>
        </g>
      ))}
      <text x={O.x + 42} y={O.y - 34} fontSize="15" fill={BLUE}>δ−</text>
      <text x={O.x - 96} y={O.y - 44} fontSize="15" fill={INK} opacity="0.7">lone pairs</text>

      {/* net dipole: crossed tail at the positive end, head at the negative end */}
      <g stroke={PEN} strokeWidth="2.5" fill="none" strokeLinecap="round">
        <line x1="340" y1="236" x2="340" y2="104" />
        <path d="M331,116 L340,102 L349,116" />
        <line x1="332" y1="222" x2="348" y2="222" />
      </g>
      <text x="352" y="176" fontSize="15" fill={PEN}>net</text>
      <text x="352" y="196" fontSize="15" fill={PEN}>dipole</text>
    </svg>
  );
}

export function StaticDiagrams() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card
        lecture="Calculus I · Derivatives"
        at="8:41"
        question="what does 'the limit of the secant' even mean?"
        note={
          <>
            Slide the second point toward <i>a</i>. The blue secant line tips until it just touches the curve. That final red line is the
            tangent, and its slope is the derivative <i>f′(a)</i>.
          </>
        }
      >
        <TangentDiagram />
      </Card>
      <Card
        lecture="General Chemistry · Molecular geometry"
        at="22:10"
        question="why is water bent and not a straight line?"
        note={
          <>
            Oxygen has four electron groups: two bonds and two lone pairs. The lone pairs push the hydrogens together, closing the angle to
            about 104.5°. Because the shape is bent, the bond dipoles don&apos;t cancel.
          </>
        }
      >
        <WaterDiagram />
      </Card>
    </div>
  );
}
