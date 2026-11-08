"use client";

import clsx from "clsx";
import { PointerEvent, ReactNode, useRef } from "react";

const MAX_TILT = 3.5; // degrees

/**
 * A card that turns gently toward the cursor with a soft sheen, like a print catching
 * gallery light (mouse only; off for reduced motion via CSS). Media goes in `media`,
 * the caption in `children`, so every gallery card in the app has the same anatomy.
 */
export function TiltCard({
  media,
  children,
  ratio = "aspect-video",
  className,
}: {
  media: ReactNode;
  children?: ReactNode;
  ratio?: string;
  className?: string;
}) {
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
      className={clsx("tilt card relative overflow-hidden p-1.5 group-hover:shadow-e3", className)}
    >
      <div className={clsx("relative overflow-hidden rounded-[9px] bg-soft", ratio)}>{media}</div>
      {children && <div className="px-2.5 pt-3 pb-2">{children}</div>}
      <div className="tilt-sheen" />
    </div>
  );
}

// Earth-tone pairs for covers of works with no footage yet; picked by id so each work keeps its own.
const COVERS = [
  ["#d9cbbb", "#b99782"],
  ["#d4d3c3", "#9da38a"],
  ["#d6cfd0", "#a99ca6"],
  ["#dccdbd", "#c09a7c"],
  ["#d0cbc0", "#958c80"],
];

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/**
 * Placeholder cover for a work without footage: a split plane in two earth tones with the
 * eye from the logo, so empty works still look intentional (and distinct from each other).
 */
export function Cover({ seed, label, small }: { seed: string; label?: string; small?: boolean }) {
  const [a, b] = COVERS[hash(seed) % COVERS.length];
  return (
    <div className="cover absolute inset-0" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
      <svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden>
        <path d="M96 0H160V90H58Z" fill="#fff" opacity="0.14" />
        {!small && (
          <g fill="none" stroke="#2b2622" strokeOpacity="0.35" strokeWidth="1.1">
            <path d="M62 46C70 36 90 36 98 46C90 55 70 55 62 46Z" />
            <circle cx="82" cy="44" r="4.5" fill="#2b2622" fillOpacity="0.28" stroke="none" />
          </g>
        )}
      </svg>
      {label && (
        <span className="absolute inset-x-0 bottom-3 text-center text-[12px] font-medium text-[#2b2622]/55">{label}</span>
      )}
    </div>
  );
}
