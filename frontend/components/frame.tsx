"use client";

import clsx from "clsx";
import { PointerEvent, ReactNode, useRef } from "react";

const MAX_TILT = 5; // degrees

/**
 * A matted frame on the wall: hairline edge, paper mat, the work inset. It tilts gently toward
 * the cursor with a soft sheen, like a print catching gallery light (mouse only; off for
 * reduced motion via CSS).
 */
export function Frame({ children, className, ratio = "aspect-[4/3]" }: { children: ReactNode; className?: string; ratio?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const el = ref.current;
    el.classList.add("is-tilting");
    el.style.setProperty("--ry", `${(x - 0.5) * 2 * MAX_TILT}deg`);
    el.style.setProperty("--rx", `${(0.5 - y) * 2 * MAX_TILT}deg`);
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove("is-tilting");
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={clsx(
        "tilt relative rounded-[6px] border border-line bg-paper p-2.5 shadow-e2 group-hover:shadow-e4",
        className,
      )}
    >
      <div className={clsx("relative overflow-hidden rounded-[3px] bg-soft shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]", ratio)}>
        {children}
      </div>
      <div className="tilt-sheen rounded-[6px]" />
    </div>
  );
}

/** Empty canvas for a work with no materials yet. */
export function BlankCanvas({ label }: { label?: string }) {
  return (
    <div className="absolute inset-0">
      <svg viewBox="0 0 100 75" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
        <path d="M58 0H100V75H38Z" className="fill-hover" />
        <path d="M0 60L58 0" className="stroke-line-strong" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
      </svg>
      {label && (
        <span className="absolute inset-0 flex items-center justify-center text-[13px] text-faint">{label}</span>
      )}
    </div>
  );
}
