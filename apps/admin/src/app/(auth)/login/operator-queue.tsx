"use client";

/**
 * Live product showcase for the sign-in aside: a miniature of the console's
 * "Needs action" queue, playing the operator story on a loop.
 *
 *   booking arrives from the app -> operator confirms -> Meet link is created
 *   -> it lands on the trainer's calendar -> the next booking arrives.
 *
 * The tilt + cursor spotlight follow the structure described for "Tilt"
 * (with spotlight) by ibelick / motion-primitives on 21st.dev (MIT):
 * pointer position -> spring-smoothed motion values -> rotateX / rotateY on a
 * perspective wrapper, and a radial highlight drawn at the pointer. No source
 * code was retrieved (the 21st.dev daily retrieval limit was reached); this
 * is an independent implementation on `motion/react`.
 *
 * Honesty: every name, booking code and Meet code below is fictional demo
 * content and the card is badged "Demo". It shows how the console works; it
 * makes no claims about usage.
 *
 * Motion: the story advances on a 1.6s timer (one state update per step, not
 * per frame); tilt and spotlight are motion values. Hovering the card pauses
 * the story. Under reduced motion the timer never starts, the tilt is off, and
 * the card rests on a single frame that shows every status at once.
 */
import * as React from "react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import {
  CalendarCheck,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  Loader2,
  Pause,
  Smartphone,
  Video,
} from "lucide-react";
import { usePrefersReducedMotion } from "./use-reduced-motion";

interface Booking {
  code: string;
  learner: string;
  initials: string;
  course: string;
  trainer: string;
  when: string;
  meet: string;
}

const BOOKINGS: Booking[] = [
  { code: "BK-7MZE", learner: "Karthik G.", initials: "KG", course: "CI/CD Pipeline on EKS", trainer: "Nalini", when: "Thu, 1:30 pm", meet: "kqe-vbtw-rmd" },
  { code: "BK-QG3V", learner: "Pranavi M.", initials: "PM", course: "MERN Stack Bootcamp", trainer: "Akhil", when: "Thu, 9:30 am", meet: "fnd-yuzc-hpa" },
  { code: "BK-83BA", learner: "Tarun G.", initials: "TG", course: "Java with Spring Boot", trainer: "Keerthana", when: "Fri, 5:00 pm", meet: "wsp-ojrx-tne" },
  { code: "BK-846V", learner: "Bhavya Y.", initials: "BY", course: "SAP FICO Functional", trainer: "Ravi", when: "Fri, 6:30 pm", meet: "hgc-mzla-qid" },
  { code: "BK-54AA", learner: "Venkatesh C.", initials: "VC", course: "Salesforce Admin", trainer: "Sravani", when: "Sat, 1:30 pm", meet: "ubr-teko-wva" },
];

/** Steps within one booking's story. */
const STEPS = 5; // 0 arrives, 1 confirming, 2 confirmed + linking, 3 Meet ready, 4 hold
const STEP_MS = 1600;
/** Deterministic first frame (SSR + reduced motion): third booking, mid-confirm. */
const REST_TICK = 2 * STEPS + 1;

type Status = "needs" | "confirming" | "linking" | "ready";

function statusFor(step: number): Status {
  if (step === 0) return "needs";
  if (step === 1) return "confirming";
  if (step === 2) return "linking";
  return "ready";
}

const pill: Record<Status | "settled", { label: string; icon: React.ElementType; cls: string; spin?: boolean }> = {
  needs: { label: "Needs action", icon: Clock3, cls: "bg-accent-soft text-on-accent-soft ring-accent/40" },
  confirming: { label: "Needs action", icon: Clock3, cls: "bg-accent-soft text-on-accent-soft ring-accent/40" },
  linking: { label: "Creating link", icon: Loader2, cls: "bg-info-soft text-on-info-soft ring-info/25", spin: true },
  ready: { label: "Meet ready", icon: Video, cls: "bg-ok-soft text-on-ok-soft ring-ok/25" },
  settled: { label: "Confirmed", icon: CheckCircle2, cls: "bg-ok-soft text-on-ok-soft ring-ok/25" },
};

const ticker: Record<number, { icon: React.ElementType; text: (b: Booking) => string }> = {
  0: { icon: Smartphone, text: (b) => `New booking from the FYT app · ${b.code}` },
  1: { icon: CalendarCheck, text: (b) => `Operator confirming ${b.code}` },
  2: { icon: Loader2, text: () => "Confirmed · creating the Google Meet link" },
  3: { icon: CalendarPlus, text: (b) => `Meet link on ${b.trainer}'s calendar · ${b.when}` },
  4: { icon: CalendarPlus, text: (b) => `Meet link on ${b.trainer}'s calendar · ${b.when}` },
};

function StatusPill({ kind }: { kind: Status | "settled" }) {
  const p = pill[kind];
  const Icon = p.icon;
  return (
    <motion.span
      key={p.label}
      initial={{ opacity: 0, y: 4, filter: "blur(2px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.28, ease: [0.25, 1, 0.5, 1] }}
      className={`inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 text-[11.5px] font-medium ring-1 ring-inset ${p.cls}`}
    >
      <Icon className={`size-3.5 ${p.spin ? "animate-spin" : ""}`} strokeWidth={2} aria-hidden />
      {p.label}
    </motion.span>
  );
}

function Row({ booking, status }: { booking: Booking; status: Status | "settled" }) {
  const active = status === "needs" || status === "confirming";
  const showMeet = status === "ready" || status === "settled";
  return (
    <div
      className={
        "relative flex items-start gap-3 rounded-[var(--radius-panel)] px-3 py-3 transition-[background-color,box-shadow] duration-300 " +
        (active ? "bg-accent-soft/45 ring-1 ring-inset ring-accent/45" : "bg-transparent")
      }
    >
      {active ? <span aria-hidden className="absolute inset-y-3 left-0 w-[3px] rounded-full bg-accent" /> : null}
      <span
        className={
          "grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold " +
          (active ? "bg-accent text-accent-ink" : "bg-sunken text-ink-2 ring-1 ring-inset ring-line")
        }
      >
        {booking.initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-ink">
          {booking.learner} <span className="font-normal text-ink-3">with</span> {booking.course}
        </p>
        <p className="num mt-0.5 truncate text-[11.5px] text-ink-2">
          {booking.code} · {booking.when} · Online
        </p>
        <AnimatePresence initial={false}>
          {showMeet ? (
            <motion.p
              key="meet"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
              className="flex items-center gap-1.5 overflow-hidden text-[11.5px] text-ink-2"
            >
              <Video className="mt-1 size-3 shrink-0 text-ok" strokeWidth={2} aria-hidden />
              <span className="num mt-1 truncate">meet.google.com/{booking.meet}</span>
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-center">
        {active ? (
          <motion.span
            animate={
              status === "confirming"
                ? { scale: [1, 0.94, 1], boxShadow: "0 0 0 3px color-mix(in oklch, var(--accent) 45%, transparent)" }
                : { scale: 1, boxShadow: "0 0 0 0px color-mix(in oklch, var(--accent) 0%, transparent)" }
            }
            transition={{ duration: 0.45, ease: [0.25, 1, 0.5, 1] }}
            className="inline-flex h-7 items-center gap-1.5 rounded-[var(--radius-control)] bg-ink px-2.5 text-[12px] font-medium text-paper"
          >
            <CalendarCheck className="size-3.5" strokeWidth={1.75} aria-hidden />
            Confirm
          </motion.span>
        ) : (
          <StatusPill kind={status} />
        )}
      </div>
    </div>
  );
}

export function OperatorQueue() {
  const reduce = usePrefersReducedMotion();
  const [tick, setTick] = React.useState(REST_TICK);
  const [hovered, setHovered] = React.useState(false);
  const running = !reduce && !hovered;

  React.useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setTick((t) => t + 1);
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [running]);

  const shownTick = reduce ? REST_TICK : tick;
  const cycle = Math.floor(shownTick / STEPS);
  const step = shownTick % STEPS;
  const at = (c: number) => BOOKINGS[((c % BOOKINGS.length) + BOOKINGS.length) % BOOKINGS.length];
  const active = at(cycle);
  const status = statusFor(step);
  const needsCount = step <= 1 ? 1 : 0;
  const Tick = ticker[step];
  const TickIcon = Tick.icon;

  // ---- Tilt + spotlight (motion values only) ----
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const lx = useMotionValue(-400);
  const ly = useMotionValue(-400);
  const spring = { stiffness: 140, damping: 18, mass: 0.5 };
  const rotateX = useSpring(useTransform(py, [0, 1], [5, -5]), spring);
  const rotateY = useSpring(useTransform(px, [0, 1], [-7, 7]), spring);
  const spotOpacity = useSpring(0, { stiffness: 120, damping: 20 });
  const spot = useMotionTemplate`radial-gradient(340px circle at ${lx}px ${ly}px, color-mix(in oklch, var(--accent) 17%, transparent), transparent 72%)`;
  const rim = useMotionTemplate`radial-gradient(260px circle at ${lx}px ${ly}px, color-mix(in oklch, var(--accent) 70%, transparent), transparent 70%)`;

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
    lx.set(e.clientX - r.left);
    ly.set(e.clientY - r.top);
  };
  const onEnter = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    setHovered(true);
    if (!reduce) spotOpacity.set(1);
  };
  const onLeave = () => {
    setHovered(false);
    px.set(0.5);
    py.set(0.5);
    spotOpacity.set(0);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative w-full [perspective:1400px]">
        <motion.div
          onPointerMove={onMove}
          onPointerEnter={onEnter}
          onPointerLeave={onLeave}
          style={reduce ? undefined : { rotateX, rotateY, transformStyle: "preserve-3d" }}
          className="relative will-change-transform"
        >
          {/* Floating chip: the booking arriving from the app */}
          <AnimatePresence>
            {step === 0 ? (
              <motion.div
                key={`arrive-${cycle}`}
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
                style={{ transform: "translateZ(50px)" }}
                className="absolute -left-5 -top-6 z-20 flex items-center gap-2 rounded-full border border-line bg-raised px-3 py-1.5 text-[12px] text-ink shadow-[var(--shadow-overlay)]"
              >
                <Smartphone className="size-3.5 text-ink-2" strokeWidth={1.75} aria-hidden />
                New booking from the app
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Floating chip: calendar confirmation */}
          <AnimatePresence>
            {step >= 3 ? (
              <motion.div
                key={`cal-${cycle}`}
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.98 }}
                transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
                style={{ transform: "translateZ(60px)" }}
                className="absolute -bottom-6 -right-5 z-20 flex items-center gap-2.5 rounded-[var(--radius-panel)] border border-line bg-raised py-2 pl-2 pr-3.5 shadow-[var(--shadow-overlay)]"
              >
                <span className="grid size-7 place-items-center rounded-[var(--radius-control)] bg-ok-soft text-on-ok-soft">
                  <CalendarPlus className="size-4" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="leading-tight">
                  <span className="block text-[12px] font-medium text-ink">Added to {active.trainer}&apos;s calendar</span>
                  <span className="num block text-[11px] text-ink-2">{active.when} IST</span>
                </span>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="relative overflow-hidden rounded-[var(--radius-overlay)] border border-line bg-surface shadow-[0_1px_2px_oklch(var(--shadow-ink)/0.06),0_30px_60px_-24px_oklch(var(--shadow-ink)/0.35)]">
            {/* Spotlight + marigold rim at the cursor */}
            <motion.div aria-hidden className="pointer-events-none absolute inset-0 z-10" style={{ background: spot, opacity: spotOpacity }} />
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-10 rounded-[var(--radius-overlay)] p-px"
              style={{
                background: rim,
                opacity: spotOpacity,
                WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                WebkitMaskComposite: "xor",
                maskComposite: "exclude",
              }}
            />

            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-line bg-sunken/60 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="flex gap-1.5" aria-hidden>
                  <span className="size-2.5 rounded-full bg-line-strong" />
                  <span className="size-2.5 rounded-full bg-line-strong" />
                  <span className="size-2.5 rounded-full bg-line-strong" />
                </span>
                <span className="ml-1 text-[12.5px] font-semibold text-ink">Needs action</span>
                <span className="num rounded-full bg-surface px-1.5 text-[11px] text-ink-2 ring-1 ring-inset ring-line">
                  {needsCount}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-dashed border-line-strong px-2 py-px text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-2">
                  Demo
                </span>
                {hovered || reduce ? (
                  <span className="inline-flex items-center gap-1 text-[11.5px] text-ink-2">
                    <Pause className="size-3" strokeWidth={2} aria-hidden /> Paused
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-2">
                    <span className="relative flex size-2">
                      <span className="absolute inset-0 animate-ping rounded-full bg-ok opacity-50" />
                      <span className="relative size-2 rounded-full bg-ok" />
                    </span>
                    Live
                  </span>
                )}
              </div>
            </div>

            {/* Queue */}
            <ul className="flex flex-col gap-1 p-2">
              <AnimatePresence initial={false} mode="popLayout">
                {[0, 1, 2].map((offset) => {
                  const c = cycle - offset;
                  return (
                    <motion.li
                      key={c}
                      layout
                      initial={{ opacity: 0, y: -16, scale: 0.98 }}
                      animate={{ opacity: offset === 2 ? 0.7 : 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 12, scale: 0.98 }}
                      transition={{ duration: 0.45, ease: [0.25, 1, 0.5, 1] }}
                    >
                      <Row booking={at(c)} status={offset === 0 ? status : "settled"} />
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>

            {/* Ticker */}
            <div className="flex items-center gap-2 border-t border-line px-4 py-2.5 text-[12px] text-ink-2">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={`${cycle}-${Math.min(step, 3)}`}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
                  className="flex min-w-0 items-center gap-2"
                >
                  <TickIcon className={`size-3.5 shrink-0 text-ink-3 ${step === 2 ? "animate-spin" : ""}`} strokeWidth={1.75} aria-hidden />
                  <span className="truncate">{Tick.text(active)}</span>
                </motion.span>
              </AnimatePresence>
              {/* Step progress, 5 segments */}
              <span className="ml-auto flex shrink-0 items-center gap-1" aria-hidden>
                {Array.from({ length: STEPS - 1 }, (_, i) => (
                  <span
                    key={i}
                    className={
                      "h-1 w-3.5 rounded-full transition-colors duration-300 " + (i <= Math.min(step, 3) ? "bg-accent" : "bg-line")
                    }
                  />
                ))}
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </MotionConfig>
  );
}
