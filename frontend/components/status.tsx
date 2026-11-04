import clsx from "clsx";
import { Badge } from "@/components/ui";
import { RunStatus } from "@/lib/api";

export const STATUS_LABELS: Record<RunStatus, string> = {
  queued: "Starting",
  planning: "Making",
  rendering: "Rendering",
  done: "Ready",
  error: "Failed",
  cancelled: "Stopped",
};

const isActive = (s: RunStatus) => s === "queued" || s === "planning" || s === "rendering";

/** A run's state as a soft badge; the dot pulses while the editor is working. */
export function StatusPill({ status, className }: { status: RunStatus; className?: string }) {
  const tone = status === "done" ? "sage" : status === "error" ? "brick" : isActive(status) ? "accent" : "neutral";
  return (
    <Badge tone={tone} className={className}>
      <span className={clsx("size-[6px] rounded-full bg-current", isActive(status) && "ink-pulse")} />
      {STATUS_LABELS[status]}
    </Badge>
  );
}
