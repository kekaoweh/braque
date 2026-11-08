"use client";

import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { ButtonHTMLAttributes, forwardRef, ReactNode, useEffect, useRef, useState } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap transition-[background,color,opacity,border-color,box-shadow,transform] duration-200 select-none active:translate-y-px",
        "disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" && "h-8 px-3 text-[13px]",
        size === "md" && "h-9 px-3.5 text-[13.5px]",
        size === "lg" && "h-11 px-5 text-[14.5px]",
        variant === "primary" &&
          "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--fg)_86%,white)_0%,var(--fg)_100%)] text-bg shadow-e2 hover:shadow-e3 active:shadow-e1",
        variant === "secondary" && "border border-line-strong bg-paper text-fg shadow-e1 hover:border-fg/25 hover:shadow-e2",
        variant === "ghost" && "text-muted hover:bg-hover hover:text-fg",
        variant === "danger" && "text-brick hover:bg-brick-soft",
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
});

/** Square icon-only button with the same hover as ghost buttons. */
export function IconButton({ className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={clsx("inline-flex size-8 items-center justify-center rounded-control text-muted transition-colors hover:bg-hover hover:text-fg", className)}
      {...rest}
    />
  );
}

/** Three ink dots, drawn in turn. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-[3px]", className)} role="status" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <span key={i} className="ink-pulse size-[4px] rounded-full bg-current" style={{ animationDelay: `${i * 0.2}s` }} />
      ))}
    </span>
  );
}

/** A soft rounded badge. Every tag and status in the app is one of these. */
export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "sage" | "brick" | "dusk";
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex h-[22px] items-center gap-1.5 rounded-full px-2 text-[11.5px] font-medium whitespace-nowrap",
        tone === "neutral" && "bg-active text-muted",
        tone === "accent" && "bg-accent-soft text-accent",
        tone === "sage" && "bg-sage-soft text-sage",
        tone === "brick" && "bg-brick-soft text-brick",
        tone === "dusk" && "bg-dusk-soft text-dusk",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Popover anchored to its trigger. */
export function Menu({
  trigger,
  children,
  align = "left",
  width = "w-56",
  up,
  className,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  width?: string;
  /** Open above the trigger (for menus at the bottom of the screen). */
  up?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className={clsx("relative inline-block", className)}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          className={clsx(
            "fade-up absolute z-50 rounded-[12px] border border-line bg-paper/95 p-1 shadow-e4 backdrop-blur-md",
            width,
            up ? "bottom-full mb-1.5" : "mt-1.5",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  children,
  onClick,
  active,
  icon,
  hint,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  icon?: ReactNode;
  hint?: ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-1.5 text-left text-[13.5px] transition-colors hover:bg-hover",
        active && "bg-hover font-medium",
        danger ? "text-brick hover:bg-brick-soft" : "text-fg",
      )}
    >
      {icon && <span className={clsx("flex w-4 shrink-0 justify-center", danger ? "text-brick" : "text-faint")}>{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="shrink-0 text-[12px] text-faint">{hint}</span>}
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="label px-2.5 pt-1.5 pb-1">{children}</div>;
}

/**
 * A select-style trigger: the same bordered box as every text field, with a chevron.
 * `label` sits above it, like any form field.
 */
export const SelectButton = forwardRef<HTMLButtonElement, {
  label?: string;
  open?: boolean;
  onClick: () => void;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}>(function SelectButton({ label, open, onClick, icon, children, className, ...rest }, ref) {
  const button = (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      data-open={open}
      className={clsx("field flex h-9 w-full items-center gap-2 pr-2.5 pl-3 text-left text-[13.5px]", className)}
      {...rest}
    >
      {icon && <span className="flex shrink-0 text-faint">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <ChevronDown className={clsx("size-3.5 shrink-0 text-faint transition-transform", open && "rotate-180")} strokeWidth={1.75} />
    </button>
  );
  if (!label) return button;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="label">{label}</span>
      {button}
    </div>
  );
});

/** Pill options in a recessed track. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: [T, ReactNode][];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={clsx("track", className)} role="group">
      {options.map(([v, label]) => (
        <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** Page heading used by every top-level page: title, one line of context, actions on the right. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
      <div className="max-w-[640px]">
        {eyebrow && <div className="label mb-2.5">{eyebrow}</div>}
        <h1 className="text-[32px] leading-[1.08] font-semibold tracking-[-0.035em] sm:text-[40px]">{title}</h1>
        {description && <p className="mt-3 text-[15px] leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Heading for a block of content inside a page: title, optional count/description, actions. */
export function SectionHeader({
  title,
  count,
  description,
  action,
  className,
}: {
  title: ReactNode;
  count?: number;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("mb-4 flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-[16px] leading-6 font-semibold tracking-[-0.015em]">
          {title}
          {count !== undefined && count > 0 && <span className="text-[13px] font-medium text-faint">{count}</span>}
        </h2>
        {description && <p className="mt-0.5 text-[13.5px] leading-relaxed text-muted">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

/** Numbered step marker, used wherever the app explains a sequence. */
export function StepNumber({ n, done }: { n: number; done?: boolean }) {
  return (
    <span
      className={clsx(
        "flex size-6 shrink-0 items-center justify-center rounded-full text-[11.5px] font-semibold",
        done ? "bg-sage-soft text-sage" : "border border-line-strong bg-paper text-muted shadow-e1",
      )}
    >
      {n}
    </span>
  );
}

/** Inline error, styled the same everywhere. */
export function ErrorNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={clsx("rounded-control border border-brick/20 bg-brick-soft px-3.5 py-2.5 text-[13px] leading-relaxed text-brick", className)}>
      {children}
    </p>
  );
}

export function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(fn);
  latest.current = fn;
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return (...args: A) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => latest.current(...args), ms);
  };
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/** On/off switch. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        checked ? "bg-accent" : "bg-line-strong",
      )}
    >
      <span
        className={clsx(
          "size-[18px] rounded-full bg-paper shadow-e1 transition-transform duration-200",
          checked ? "translate-x-[18px]" : "translate-x-[2px]",
        )}
      />
    </button>
  );
}
