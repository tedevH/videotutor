import { useId } from "react";

/**
 * A chalkboard "lecture frame": area under y = x², with the thin strip dA at x = 3.
 * Coordinates: origin (80, 380), 120px per x unit, 20px per y unit.
 */
export function LectureBoard({ className = "" }: { className?: string }) {
  const hatch = `hatch-${useId().replace(/:/g, "")}`;
  const X = (x: number) => 80 + x * 120;
  const Y = (y: number) => 380 - y * 20;
  const curve = Array.from({ length: 41 }, (_, i) => {
    const x = (i / 40) * 4;
    return `${i ? "L" : "M"}${X(x).toFixed(1)},${Math.max(40, Y(x * x)).toFixed(1)}`;
  }).join(" ");
  const area = `M${X(0)},${Y(0)} ${Array.from({ length: 31 }, (_, i) => {
    const x = (i / 30) * 3;
    return `L${X(x).toFixed(1)},${Y(x * x).toFixed(1)}`;
  }).join(" ")} L${X(3)},${Y(0)} Z`;

  return (
    <svg viewBox="0 0 760 428" className={className} role="img" aria-label="Chalkboard: the area under y equals x squared, with a thin strip dA at x equals 3">
      <defs>
        <pattern id={hatch} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <line x1="0" y1="0" x2="0" y2="9" stroke="#e9dc8a" strokeWidth="2" opacity="0.35" />
        </pattern>
      </defs>
      <rect width="760" height="428" fill="#22302a" />
      <rect width="760" height="428" fill={`url(#${hatch})`} opacity="0.05" />

      {/* axes */}
      <path d={`M${X(0)},400 L${X(0)},40 M60,${Y(0)} L${X(4.3)},${Y(0)}`} stroke="#e8e4d8" strokeWidth="2.5" fill="none" opacity="0.8" />
      {[1, 2, 4].map((n) => (
        <g key={n}>
          <line x1={X(n)} y1={Y(0) - 6} x2={X(n)} y2={Y(0) + 6} stroke="#e8e4d8" strokeWidth="2" opacity="0.7" />
          <text x={X(n)} y={Y(0) + 30} fill="#e8e4d8" opacity="0.75" fontSize="18" textAnchor="middle">
            {n}
          </text>
        </g>
      ))}

      {/* area and strip */}
      <path d={area} fill={`url(#${hatch})`} />
      <path d={area} fill="#e9dc8a" opacity="0.12" />
      <rect x={X(3)} y={Y(9)} width="16" height={Y(0) - Y(9)} fill="#f7c948" opacity="0.85" />

      {/* curve */}
      <path d={curve} stroke="#9fd3c7" strokeWidth="4" fill="none" strokeLinecap="round" />

      {/* chalk labels */}
      <text x={X(2.5)} y={120} fill="#9fd3c7" fontSize="24">y = x²</text>
      <text x={X(1.25)} y={Y(2.2)} fill="#e9dc8a" fontSize="28">A(x)</text>
      <text x={X(3) + 50} y={Y(7.7)} fill="#f7c948" fontSize="23">dA</text>
      <text x={X(3) + 8} y={Y(0) + 30} fill="#f7c948" fontSize="18" textAnchor="middle">x</text>
      
      <text x="130" y="84" fill="#e8e4d8" fontSize="31">dA/dx = x²</text>
      <path d="M126,96 C170,104 250,100 310,94" stroke="#e8e4d8" strokeWidth="2" fill="none" opacity="0.6" />
    </svg>
  );
}
