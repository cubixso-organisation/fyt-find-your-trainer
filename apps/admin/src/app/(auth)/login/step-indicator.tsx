/**
 * The two sign-in steps, shared by /login and /login/verify: "1 Sign in" then
 * "2 Verify". The current step is filled ink; a finished step shows a check.
 * No hooks, so it renders in server and client components alike.
 */
import { Check } from "lucide-react";

const STEPS = ["Sign in", "Verify"] as const;

export function StepIndicator({ current }: { current: 1 | 2 }) {
  return (
    <ol aria-label="Sign-in steps" className="flex items-center gap-2.5 text-[12.5px] font-medium">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const on = n === current;
        return (
          <li key={label} aria-current={on ? "step" : undefined} className="flex items-center gap-2.5">
            {i > 0 ? <span aria-hidden className={"h-px w-7 " + (current > i ? "bg-ink-2" : "bg-line-strong")} /> : null}
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className={
                  "num grid size-5 place-items-center rounded-full text-[11px] leading-none " +
                  (on ? "bg-ink text-paper" : done ? "bg-sunken text-ink ring-1 ring-inset ring-line-strong" : "text-ink-3 ring-1 ring-inset ring-line-strong")
                }
              >
                {done ? <Check className="size-3" strokeWidth={2.5} /> : n}
              </span>
              <span className={on ? "text-ink" : done ? "text-ink-2" : "text-ink-3"}>
                <span className="sr-only">{`Step ${n}: `}</span>
                {label}
                {done ? <span className="sr-only"> (done)</span> : null}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
