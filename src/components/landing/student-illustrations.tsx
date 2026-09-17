const INK = "#1c1b19";
const PEN = "#d9480f";

/** A phone playing AP Bio, paused, with the question you'd never ask out loud. */
export function HighSchoolIllustration() {
  return (
    <svg viewBox="0 0 320 200" className="h-auto w-full" role="img" aria-label="A phone paused on an AP Biology video with a question bubble">
      {/* notebook lines behind */}
      {[150, 166, 182].map((y) => (
        <line key={y} x1="0" y1={y} x2="320" y2={y} stroke={INK} strokeOpacity="0.08" strokeWidth="1.5" />
      ))}
      {/* phone */}
      <rect x="40" y="24" width="112" height="170" rx="16" fill="#fff" stroke={INK} strokeWidth="3" />
      <rect x="50" y="44" width="92" height="62" rx="4" fill="#2f4a3a" />
      {/* cell on the screen */}
      <ellipse cx="96" cy="75" rx="30" ry="20" fill="#9fd3c7" opacity="0.9" />
      <circle cx="96" cy="75" r="8" fill="#f7c948" />
      <rect x="84" y="62" width="8" height="26" rx="2" fill="#fff" opacity="0.9" />
      <rect x="99" y="62" width="8" height="26" rx="2" fill="#fff" opacity="0.9" />
      <text x="96" y="124" textAnchor="middle" fontSize="11" fontWeight="600" fill={INK}>AP Bio · Mitosis</text>
      <rect x="54" y="134" width="84" height="4" rx="2" fill={INK} opacity="0.12" />
      <rect x="54" y="134" width="52" height="4" rx="2" fill={PEN} />
      <rect x="54" y="152" width="84" height="22" rx="8" fill="#f3efe6" />
      <text x="62" y="167" fontSize="10" fill={INK} opacity="0.5">typing…</text>
      {/* question bubble */}
      <path d="M170 38 h118 a14 14 0 0 1 14 14 v44 a14 14 0 0 1 -14 14 h-86 l-20 18 v-18 h-12 a14 14 0 0 1 -14 -14 v-44 a14 14 0 0 1 14 -14z" fill="#fff" stroke={INK} strokeWidth="3" />
      <text x="178" y="68" fontSize="12.5" fontWeight="600" fill={INK}>wait, when do the</text>
      <text x="178" y="87" fontSize="12.5" fontWeight="600" fill={INK}>chromosomes split?</text>
      <circle cx="296" cy="34" r="13" fill={PEN} />
      <text x="296" y="40" textAnchor="middle" fontSize="16" fontWeight="700" fill="#fff">?</text>
    </svg>
  );
}

/** Laptop with a lecture at 2:07 a.m., moon out, coffee going cold. */
export function CollegeIllustration() {
  return (
    <svg viewBox="0 0 320 200" className="h-auto w-full" role="img" aria-label="A laptop playing a lecture late at night next to a mug">
      {/* night window */}
      <rect x="208" y="14" width="96" height="70" rx="8" fill="#2b3a67" />
      <circle cx="274" cy="42" r="15" fill="#ffe8a3" />
      <circle cx="281" cy="36" r="13" fill="#2b3a67" />
      {[[226, 30], [240, 62], [292, 70], [222, 54]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.8" fill="#fff" />
      ))}
      <line x1="256" y1="14" x2="256" y2="84" stroke="#fff" strokeOpacity="0.15" strokeWidth="2" />
      {/* laptop */}
      <rect x="28" y="40" width="160" height="104" rx="8" fill="#fff" stroke={INK} strokeWidth="3" />
      <rect x="38" y="50" width="140" height="84" rx="3" fill="#22302a" />
      <path d="M48 124 C80 122 110 110 130 88 C145 72 155 62 168 56" stroke="#9fd3c7" strokeWidth="3" fill="none" />
      <path d="M48 124 L48 58" stroke="#e8e4d8" strokeWidth="1.5" opacity="0.6" />
      <path d="M44 124 L172 124" stroke="#e8e4d8" strokeWidth="1.5" opacity="0.6" />
      <text x="60" y="74" fontSize="13" fill="#e8e4d8">∫ f(x) dx</text>
      <path d="M12 146 h204 l-14 14 h-176z" fill="#fff" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      {/* clock */}
      <rect x="214" y="104" width="86" height="34" rx="8" fill={INK} />
      <text x="257" y="127" textAnchor="middle" fontSize="18" fontWeight="700" fill="#ffe8a3" style={{ fontVariantNumeric: "tabular-nums" }}>
        2:07 AM
      </text>
      {/* mug */}
      <path d="M236 150 h40 v30 a10 10 0 0 1 -10 10 h-20 a10 10 0 0 1 -10 -10z" fill={PEN} stroke={INK} strokeWidth="3" />
      <path d="M276 158 h6 a8 8 0 0 1 0 16 h-6" fill="none" stroke={INK} strokeWidth="3" />
      <path d="M250 146 c-3 -4 3 -6 0 -8 M262 146 c-3 -4 3 -6 0 -8" stroke={INK} strokeOpacity="0.35" strokeWidth="2" fill="none" />
    </svg>
  );
}

/** A review sheet built from past questions: timestamps, a tiny diagram, a highlight. */
export function ExamIllustration() {
  const rows = [
    { t: "4:12", w: 108 },
    { t: "13:02", w: 84 },
    { t: "22:40", w: 116 },
  ];
  return (
    <svg viewBox="0 0 320 200" className="h-auto w-full" role="img" aria-label="A review sheet listing saved questions with timestamps and a small graph">
      {/* back sheet */}
      <rect x="70" y="20" width="200" height="172" rx="10" fill="#fff" stroke={INK} strokeOpacity="0.25" strokeWidth="2" transform="rotate(5 170 106)" />
      {/* front sheet */}
      <rect x="50" y="14" width="200" height="176" rx="10" fill="#fff" stroke={INK} strokeWidth="3" transform="rotate(-3 150 102)" />
      <g transform="rotate(-3 150 102)">
        <text x="68" y="42" fontSize="15" fontWeight="700" fill={INK}>Final review</text>
        <rect x="160" y="30" width="72" height="16" rx="8" fill="#ffe066" />
        <text x="196" y="42" textAnchor="middle" fontSize="10" fontWeight="600" fill={INK}>6 questions</text>
        {rows.map((r, i) => (
          <g key={r.t} transform={`translate(0 ${58 + i * 24})`}>
            <rect x="66" y="0" width="50" height="16" rx="8" fill={PEN} opacity="0.14" />
            <text x="91" y="12" textAnchor="middle" fontSize="10" fontWeight="600" fill={PEN}>@{r.t}</text>
            <rect x="124" y="5" width={r.w} height="6" rx="3" fill={INK} opacity="0.18" />
          </g>
        ))}
        {/* mini graph */}
        <rect x="66" y="132" width="168" height="46" rx="6" fill="#f6f2e9" />
        <path d="M76 170 C110 168 140 160 160 146 C172 138 182 136 190 136" stroke="#1c64d6" strokeWidth="2.5" fill="none" />
        <path d="M76 170 C110 168 140 160 160 146 L160 170Z" fill="#1c64d6" opacity="0.15" />
        <line x1="160" y1="144" x2="160" y2="172" stroke={PEN} strokeWidth="2.5" />
        <path d="M204 142 l6 6 l14 -16" stroke="#16a34a" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
