import { useEffect, useState } from "react";

interface Props {
  endsAt: string | null;
  totalSeconds: number;
  onExpire?: () => void;
}

export function RoundTimer({ endsAt, totalSeconds, onExpire }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const remaining = endsAt
    ? Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / 1000))
    : totalSeconds;
  const fired = remaining === 0 && endsAt !== null;

  useEffect(() => {
    if (fired) onExpire?.();
  }, [fired, onExpire]);

  const pct = endsAt
    ? Math.max(
        0,
        Math.min(
          100,
          ((new Date(endsAt).getTime() - now) / (totalSeconds * 1000)) * 100,
        ),
      )
    : 100;

  const color =
    remaining <= 10 ? "var(--color-destructive)" : "var(--color-foreground)";

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex h-10 w-14 items-center justify-center rounded-md border-2 border-foreground bg-card font-extrabold tabular-nums shadow-brutal-sm"
        style={{ color }}
        aria-label="Time remaining"
      >
        {remaining}
      </div>
      <div
        className="hidden h-3 w-32 overflow-hidden rounded-md border-2 border-foreground bg-card sm:block"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-primary transition-[width] duration-200 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
