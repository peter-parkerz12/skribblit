import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";

interface Props {
  code: string;
  className?: string;
}

export function RoomCodeChip({ code, className = "" }: Props) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  async function copy(value: string, kind: "code" | "link") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1400);
    } catch {
      /* ignore */
    }
  }

  const url =
    typeof window !== "undefined" ? `${window.location.origin}/r/${code}` : "";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-2 rounded-md border-2 border-foreground bg-primary px-3 py-1.5 shadow-brutal-sm">
        <span className="text-xs font-extrabold uppercase tracking-wide opacity-70">
          Room
        </span>
        <span className="font-mono text-lg font-extrabold tracking-[0.2em]">
          {code}
        </span>
      </div>
      <button
        type="button"
        onClick={() => copy(code, "code")}
        className="brutal-press flex h-9 items-center gap-1 rounded-md border-2 border-foreground bg-card px-2.5 text-xs font-extrabold shadow-brutal-sm"
        aria-label="Copy room code"
      >
        {copied === "code" ? (
          <Check className="h-4 w-4" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">Code</span>
      </button>
      <button
        type="button"
        onClick={() => copy(url, "link")}
        className="brutal-press flex h-9 items-center gap-1 rounded-md border-2 border-foreground bg-card px-2.5 text-xs font-extrabold shadow-brutal-sm"
        aria-label="Copy room link"
      >
        {copied === "link" ? (
          <Check className="h-4 w-4" />
        ) : (
          <Share2 className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">Link</span>
      </button>
    </div>
  );
}
