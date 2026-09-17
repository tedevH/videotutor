/** "Everything Lumo does": each feature with a tiny, real-looking preview of the product. */

function Card({ title, body, children, className = "" }: { title: string; body: string; children: React.ReactNode; className?: string }) {
  return (
    <article className={`flex flex-col overflow-hidden rounded-3xl border border-ink/10 bg-white ${className}`}>
      <div className="flex min-h-[150px] flex-1 items-center justify-center bg-[#faf7f0] p-5">{children}</div>
      <div className="p-5">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-1.5 text-[15px] leading-relaxed text-ink/70">{body}</p>
      </div>
    </article>
  );
}

function BrainPreview() {
  const rows = [
    ["Derivatives", 88, "bg-green-600", "mastered"],
    ["Chain rule", 52, "bg-amber-500", "developing"],
    ["Related rates", 24, "bg-red-500", "shaky"],
  ] as const;
  return (
    <div className="w-full max-w-[300px] space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      {rows.map(([name, pct, color, level]) => (
        <div key={name}>
          <div className="flex justify-between text-xs">
            <span className="font-medium">{name}</span>
            <span className="text-muted">{level}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-ink/10">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      ))}
      <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">Keeps forgetting the inner derivative (seen 3×)</p>
    </div>
  );
}

function SocraticPreview() {
  return (
    <div className="w-full max-w-[300px] space-y-2 text-sm">
      <p className="ml-auto w-fit rounded-2xl rounded-tr-sm bg-stone-200/70 px-3 py-1.5">how do I solve this?</p>
      <p className="w-fit rounded-2xl rounded-tl-sm bg-white px-3 py-1.5 shadow-sm">Before calculating, what does the problem give you?</p>
      <p className="ml-auto w-fit rounded-2xl rounded-tr-sm bg-stone-200/70 px-3 py-1.5">the rate the radius grows</p>
      <p className="w-fit rounded-2xl rounded-tl-sm bg-white px-3 py-1.5 shadow-sm">
        <span className="font-semibold text-green-700">✓ Right.</span> What equation links radius and area?
      </p>
    </div>
  );
}

function BoardPreview() {
  return (
    <svg viewBox="0 0 300 150" className="w-full max-w-[320px] rounded-2xl bg-white shadow-sm" role="img" aria-label="Whiteboard with a solved equation and a student's pen mark">
      <g fontFamily="ui-serif, Georgia, serif" fontStyle="italic" fontSize="19" fill="#1c1b19">
        <text x="22" y="36">2x + 6 = 14</text>
        <text x="22" y="72">2x = 8</text>
        <text x="22" y="108" fill="#2563eb">x = 4</text>
      </g>
      <ellipse cx="54" cy="102" rx="44" ry="17" fill="none" stroke="#ea580c" strokeWidth="2.5" />
      <path d="M180 110 C195 60 220 40 270 30" fill="none" stroke="#7c3aed" strokeWidth="3" strokeLinecap="round" />
      <path d="M170 120 L285 120 M180 130 L180 25" stroke="#1c1b19" strokeOpacity="0.35" strokeWidth="1.5" />
      <path d="M205 85 q10 -12 22 -4 t18 -8" fill="none" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" />
      <text x="226" y="140" fontSize="10" fill="#6b6860">your drawing</text>
    </svg>
  );
}

function PracticePreview() {
  return (
    <div className="w-full max-w-[300px] rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-900">easy</span>
        <span className="text-ink/30">→</span>
        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-900">medium</span>
        <span className="text-ink/30">→</span>
        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-orange-900">hard</span>
        <span className="text-ink/30">→</span>
        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-purple-900">transfer</span>
      </div>
      <p className="mt-3 text-sm">Find the derivative of (3x − 1)⁴</p>
      <p className="mt-2 rounded-lg bg-amber-100 px-2 py-1 text-[11px] text-amber-900">targets a mistake you&apos;ve made</p>
      <div className="mt-3 h-1.5 rounded-full bg-ink/10">
        <div className="h-full w-[62%] rounded-full bg-pen" />
      </div>
      <p className="mt-1 text-[11px] text-muted">Chain rule mastery 45% → 62%</p>
    </div>
  );
}

function CoursePreview() {
  return (
    <div className="flex w-full max-w-[320px] items-center gap-3">
      <div className="w-24 shrink-0 rotate-[-4deg] rounded-md bg-white p-2 shadow-sm">
        <p className="text-[9px] font-bold">PHYS 7A</p>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="mt-1 h-1 rounded bg-ink/15" style={{ width: `${60 + ((i * 13) % 35)}%` }} />
        ))}
        <p className="mt-1.5 text-[8px] text-pen">Midterm Oct 8</p>
      </div>
      <span className="text-xl text-ink/40">→</span>
      <div className="flex-1 space-y-1.5 rounded-2xl bg-white p-3 text-[11px] shadow-sm">
        <p className="font-semibold text-pen">Exam in 5 days</p>
        {[
          ["Today", "Newton's laws, Friction"],
          ["Tomorrow", "Energy conservation"],
          ["Final review", "Your 4 weakest topics"],
        ].map(([day, what]) => (
          <p key={day}>
            <span className="font-semibold">{day}:</span> {what}
          </p>
        ))}
      </div>
    </div>
  );
}

function MemoryPreview() {
  const curve = Array.from({ length: 30 }, (_, i) => `${i ? "L" : "M"}${10 + i * 9},${20 + 80 * (1 - Math.pow(0.9, i / 3))}`).join(" ");
  return (
    <div className="w-full max-w-[300px] space-y-3">
      <div className="rounded-2xl bg-white px-3 py-2.5 text-sm shadow-sm">
        <p className="text-xs font-semibold text-sky-800">Quick review</p>
        <p>You haven&apos;t reviewed rotational dynamics in 6 weeks. Let&apos;s see what you remember.</p>
      </div>
      <svg viewBox="0 0 280 110" className="w-full" aria-label="Recall decays until a review brings it back up">
        <path d={curve} fill="none" stroke="#1c1b19" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="4 4" />
        <path d="M10,20 C60,45 100,62 140,70 L140,22 C190,32 230,40 270,46" fill="none" stroke="#d9480f" strokeWidth="2.5" />
        <circle cx="140" cy="22" r="4" fill="#d9480f" />
        <text x="146" y="16" fontSize="10" fill="#d9480f">review</text>
      </svg>
    </div>
  );
}

function VoicePreview() {
  return (
    <div className="flex w-full max-w-[300px] flex-col items-center gap-3">
      <div className="relative grid h-16 w-16 place-items-center rounded-full bg-red-50 text-2xl">
        <span className="absolute inset-0 animate-ping rounded-full bg-red-200/60" />
        <span className="relative">🎙️</span>
      </div>
      <p className="rounded-2xl bg-white px-3 py-1.5 text-sm shadow-sm">&ldquo;Wait, why did they cancel that?&rdquo;</p>
      <p className="text-xs text-muted">❚❚ Lecture paused at 12:03 · resumes when you&apos;ve got it</p>
    </div>
  );
}

function VisualsPreview() {
  return (
    <div className="grid w-full max-w-[320px] grid-cols-4 gap-2">
      {/* graph */}
      <svg viewBox="0 0 60 60" className="rounded-xl bg-white p-1 shadow-sm" aria-label="Graph">
        <path d="M8 52 H56 M8 52 V4" stroke="#1c1b19" strokeOpacity="0.4" />
        <path d="M8 52 C25 50 40 30 54 6" fill="none" stroke="#2563eb" strokeWidth="2.5" />
        <path d="M8 52 C25 50 36 38 40 30 L40 52 Z" fill="#16a34a" opacity="0.2" />
      </svg>
      {/* molecule */}
      <svg viewBox="0 0 60 60" className="rounded-xl bg-white p-1 shadow-sm" aria-label="Molecule">
        <polygon points="30,10 47,20 47,40 30,50 13,40 13,20" fill="none" stroke="#1c1b19" strokeWidth="2" />
        <line x1="47" y1="20" x2="57" y2="12" stroke="#dc2626" strokeWidth="2" />
        <text x="50" y="10" fontSize="9" fill="#dc2626">OH</text>
      </svg>
      {/* forces */}
      <svg viewBox="0 0 60 60" className="rounded-xl bg-white p-1 shadow-sm" aria-label="Free-body diagram">
        <rect x="22" y="22" width="16" height="16" fill="none" stroke="#1c1b19" strokeWidth="2" />
        <path d="M30 30 V55 M26 50 L30 56 L34 50" fill="none" stroke="#dc2626" strokeWidth="2" />
        <path d="M30 30 V5 M26 10 L30 4 L34 10" fill="none" stroke="#2563eb" strokeWidth="2" />
        <path d="M30 30 H56 M51 26 L57 30 L51 34" fill="none" stroke="#16a34a" strokeWidth="2" />
      </svg>
      {/* tree */}
      <svg viewBox="0 0 60 60" className="rounded-xl bg-white p-1 shadow-sm" aria-label="Data structure">
        <path d="M30 14 L16 34 M30 14 L44 34 M16 34 L10 52 M16 34 L24 52" stroke="#1c1b19" strokeWidth="1.5" />
        {[
          [30, 14, true],
          [16, 34, true],
          [44, 34, false],
          [10, 52, false],
          [24, 52, true],
        ].map(([x, y, hl], i) => (
          <circle key={i} cx={x as number} cy={y as number} r="6" fill={hl ? "#fde68a" : "#fff"} stroke="#1c1b19" strokeWidth="1.5" />
        ))}
      </svg>
    </div>
  );
}

export function FeatureGrid() {
  return (
    <div className="grid gap-5 md:grid-cols-6">
      <Card className="md:col-span-3" title="Lumo Brain remembers how you learn" body="It tracks what you've mastered, what's fading, the mistakes you keep making, and which explanations work for you, so month three starts where month two ended.">
        <BrainPreview />
      </Card>
      <Card className="md:col-span-3" title="Socratic by default" body="Lumo asks the question that gets you to the next step, checks your answer, and switches to a hint, an example or a full explanation when you need it. Or tap Just explain.">
        <SocraticPreview />
      </Card>
      <Card className="md:col-span-2" title="A shared whiteboard" body="Lumo writes, draws, graphs and circles things step by step. Draw your attempt and it sees exactly where you went wrong.">
        <BoardPreview />
      </Card>
      <Card className="md:col-span-2" title="Practice that adapts" body="The next problem is picked for you: easier when you're stuck, harder when you're ready, and built to fix the mistake you just made.">
        <PracticePreview />
      </Card>
      <Card className="md:col-span-2" title="Talk to your lecture" body="Say “wait, why did they cancel that?” The video pauses, Lumo explains, asks a quick check, and picks the lecture back up.">
        <VoicePreview />
      </Card>
      <Card className="md:col-span-2" title="Every course, mapped" body="Drop in your syllabus, slides, homework and past exams. Lumo builds the course map and a day-by-day plan for exam week.">
        <CoursePreview />
      </Card>
      <Card className="md:col-span-2" title="Reviews right before you forget" body="Lumo schedules quick checks when your memory of a topic starts to fade, which makes it stick far longer than cramming.">
        <MemoryPreview />
      </Card>
      <Card className="md:col-span-2" title="The right picture for every subject" body="Graphs and 3D surfaces, molecules and reactions, forces drawn to scale, and step-by-step trees, stacks and pointers.">
        <VisualsPreview />
      </Card>
    </div>
  );
}
