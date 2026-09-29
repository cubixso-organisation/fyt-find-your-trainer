/**
 * Quiet illustration for the sign-in aside: an abstract working week of
 * booking blocks on a time grid, drawn entirely from design-system tokens.
 *
 * It replaces the testimonial slot the source component shipped with — the
 * console shows no social proof, so the aside shows the product instead.
 * One marigold block marks "the booking that needs you", echoing how the
 * accent is used inside the console.
 */
const DAYS = ["MON", "TUE", "WED", "THU", "FRI"];
const ROWS = 7; // 09:00 → 15:00
const GUTTER = 46; // room for the hour column
const HEAD = 24; // room for the day row
const CW = 102;
const RH = 46;
const W = GUTTER + DAYS.length * CW;
const H = HEAD + ROWS * RH + 6;

type Tone = "ink" | "mid" | "soft" | "accent";

/** [column, row, rowSpan, tone] */
const blocks: Array<[number, number, number, Tone]> = [
  [0, 0, 1, "soft"],
  [0, 2, 2, "ink"],
  [0, 5, 1, "mid"],
  [1, 1, 1, "mid"],
  [1, 3, 1, "soft"],
  [1, 5, 2, "soft"],
  [2, 0, 2, "mid"],
  [2, 3, 1, "accent"],
  [2, 6, 1, "ink"],
  [3, 1, 2, "soft"],
  [3, 4, 1, "mid"],
  [4, 0, 1, "ink"],
  [4, 2, 1, "soft"],
  [4, 4, 2, "mid"],
];

const fill: Record<Tone, string> = {
  ink: "var(--ink)",
  mid: "var(--line-strong)",
  soft: "var(--line)",
  accent: "var(--accent)",
};

/** The column standing in for "today" gets a quiet band behind it. */
const TODAY = 2;

export function ScheduleArt({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox={`0 0 ${W} ${H}`} className={className} preserveAspectRatio="xMidYMid meet">
      {/* "today" band */}
      <rect x={GUTTER + TODAY * CW} y={0} width={CW} height={HEAD + ROWS * RH} fill="var(--sunken)" opacity={0.75} />

      {/* day header */}
      {DAYS.map((day, c) => (
        <text
          key={day}
          x={GUTTER + c * CW + CW / 2}
          y={12}
          textAnchor="middle"
          fontSize={10}
          letterSpacing={1.4}
          fill={c === TODAY ? "var(--ink-2)" : "var(--ink-3)"}
          fontFamily="var(--font-geist-sans)"
          fontWeight={c === TODAY ? 600 : 500}
        >
          {day}
        </text>
      ))}

      {/* hour rules */}
      {Array.from({ length: ROWS + 1 }, (_, r) => (
        <line
          key={`r${r}`}
          x1={GUTTER}
          x2={W}
          y1={HEAD + r * RH}
          y2={HEAD + r * RH}
          stroke="var(--line)"
          strokeWidth={1}
        />
      ))}

      {/* day separators */}
      {Array.from({ length: DAYS.length + 1 }, (_, c) => (
        <line
          key={`c${c}`}
          x1={GUTTER + c * CW}
          x2={GUTTER + c * CW}
          y1={HEAD}
          y2={HEAD + ROWS * RH}
          stroke="var(--line)"
          strokeWidth={1}
          strokeDasharray="2 5"
        />
      ))}

      {/* hour labels */}
      {Array.from({ length: ROWS }, (_, r) => (
        <text
          key={`t${r}`}
          x={GUTTER - 10}
          y={HEAD + r * RH + 13}
          textAnchor="end"
          fontSize={10.5}
          fill="var(--ink-3)"
          fontFamily="var(--font-geist-mono)"
        >
          {`${String(9 + r).padStart(2, "0")}:00`}
        </text>
      ))}

      {/* booking blocks */}
      {blocks.map(([c, r, span, tone], i) => {
        const x = GUTTER + c * CW + 5;
        const y = HEAD + r * RH + 5;
        const w = CW - 10;
        const h = span * RH - 10;
        return (
          <g key={i}>
            {tone === "accent" ? (
              <rect x={x - 3} y={y - 3} width={w + 6} height={h + 6} rx={8} fill="var(--accent-soft)" />
            ) : null}
            <rect x={x} y={y} width={w} height={h} rx={6} fill={fill[tone]} opacity={tone === "ink" ? 0.7 : 1} />
          </g>
        );
      })}
    </svg>
  );
}
