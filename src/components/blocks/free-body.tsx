import { INK } from "@/lib/sketch";

type Force = { label: string; kind: string; magnitude: number; angle_deg: number; color: string; show_components: boolean };

const SIZE = 320;
const C = SIZE / 2;
const MAX_LEN = 105;

/** Forces drawn to scale from their magnitudes and directions, on flat ground or an incline. */
export function FreeBody({
  title,
  object,
  inclineDeg,
  forces,
  axes,
}: {
  title: string;
  object: "box" | "ball" | "point";
  inclineDeg: number | null;
  forces: Force[];
  axes: "standard" | "incline";
}) {
  const max = Math.max(...forces.map((f) => f.magnitude), 1e-9);
  const tilt = inclineDeg ?? 0;
  const rad = (d: number) => (d * Math.PI) / 180;
  // Page coordinates: y grows downward, angles are counterclockwise from +x.
  const tip = (len: number, angle: number): [number, number] => [C + len * Math.cos(rad(angle)), C - len * Math.sin(rad(angle))];
  const axisAngles = axes === "incline" && inclineDeg ? [tilt, tilt + 90] : [0, 90];

  const arrow = (from: [number, number], to: [number, number], color: string, width: number, dashed = false, key = "") => {
    const ang = Math.atan2(to[1] - from[1], to[0] - from[0]);
    const h = 9;
    const l: [number, number] = [to[0] - h * Math.cos(ang - 0.4), to[1] - h * Math.sin(ang - 0.4)];
    const r: [number, number] = [to[0] - h * Math.cos(ang + 0.4), to[1] - h * Math.sin(ang + 0.4)];
    return (
      <g key={key}>
        <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke={color} strokeWidth={width} strokeDasharray={dashed ? "5 4" : undefined} strokeLinecap="round" />
        <path d={`M${l[0]},${l[1]} L${to[0]},${to[1]} L${r[0]},${r[1]}`} fill="none" stroke={color} strokeWidth={width} strokeLinejoin="round" />
      </g>
    );
  };

  // Ramp: surface through the object's contact point, rising to the right.
  const rampLen = 150;
  // The object's bottom face touches the ramp: offset from its center along the surface normal.
  const contact: [number, number] = [C + 22 * Math.sin(rad(tilt)), C + 22 * Math.cos(rad(tilt))];
  const along: [number, number] = [Math.cos(rad(tilt)), -Math.sin(rad(tilt))];
  const rampTop: [number, number] = [contact[0] + along[0] * rampLen, contact[1] + along[1] * rampLen];
  const rampBottom: [number, number] = [contact[0] - along[0] * rampLen, contact[1] - along[1] * rampLen];
  const groundY = Math.max(rampTop[1], rampBottom[1]);

  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-white">
      {title && <figcaption className="border-b border-line px-3 py-2 text-sm font-semibold">{title}</figcaption>}
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto block w-full max-w-[380px]" role="img" aria-label={`Free-body diagram: ${forces.map((f) => f.label).join(", ")}`}>
        {inclineDeg ? (
          <path d={`M${rampBottom[0]},${rampBottom[1]} L${rampTop[0]},${rampTop[1]} L${rampTop[0]},${groundY} Z`} fill="#f3efe6" stroke="#1c1b19" strokeWidth="1.5" />
        ) : object !== "point" ? (
          <line x1={20} y1={contact[1]} x2={SIZE - 20} y2={contact[1]} stroke="#1c1b19" strokeWidth="1.5" />
        ) : null}
        {inclineDeg ? (
          <text x={rampBottom[0] + 34} y={rampBottom[1] - 6} fontSize="12" fill="#6b6860">
            {inclineDeg}°
          </text>
        ) : null}

        {/* axes */}
        {axisAngles.map((a, i) => {
          const p = tip(135, a);
          const n = tip(-135, a);
          return <line key={i} x1={n[0]} y1={n[1]} x2={p[0]} y2={p[1]} stroke="#1c1b19" strokeOpacity="0.15" strokeDasharray="3 4" />;
        })}

        <g transform={`rotate(${-tilt} ${C} ${C})`}>
          {object === "box" && <rect x={C - 22} y={C - 22} width="44" height="44" fill="#fff" stroke="#1c1b19" strokeWidth="2" rx="3" />}
          {object === "ball" && <circle cx={C} cy={C} r="22" fill="#fff" stroke="#1c1b19" strokeWidth="2" />}
        </g>
        {object === "point" && <circle cx={C} cy={C} r="5" fill="#1c1b19" />}

        {forces.map((f, i) => {
          const len = Math.max(18, (f.magnitude / max) * MAX_LEN);
          const end = tip(len, directionOf(f, tilt));
          const color = INK[f.color] ?? INK.red;
          const labelPos = tip(len + 16, directionOf(f, tilt));
          return (
            <g key={i}>
              {f.show_components &&
                axisAngles.map((a, k) => {
                  const component = len * Math.cos(rad(directionOf(f, tilt) - a));
                  if (Math.abs(component) < 4) return null;
                  return arrow([C, C], tip(component, a), color, 1.5, true, `c${k}`);
                })}
              {arrow([C, C], end, color, 3, false, "main")}
              <text x={labelPos[0]} y={labelPos[1] + 4} fontSize="14" fontWeight="600" fill={color} textAnchor="middle" stroke="white" strokeWidth="3" paintOrder="stroke">
                {f.label}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="border-t border-line px-3 py-2 text-xs text-muted">
        Arrow lengths are to scale: {forces.map((f) => `${f.label} = ${Number(f.magnitude.toFixed(2))}`).join(", ")}
      </p>
    </figure>
  );
}

/** Direction in degrees (counterclockwise from +x) computed from the force's physical kind and the incline. */
function directionOf(f: Force, tilt: number) {
  // On flat ground "up/down slope" is ambiguous, so an explicit angle (e.g. opposing motion) wins.
  if (!tilt && f.kind.startsWith("friction") && f.angle_deg !== 0) return f.angle_deg;
  switch (f.kind) {
    case "gravity":
      return -90;
    case "normal":
      return 90 + tilt;
    case "friction_up_slope":
      return tilt;
    case "friction_down_slope":
      return tilt + 180;
    default:
      return f.angle_deg;
  }
}
