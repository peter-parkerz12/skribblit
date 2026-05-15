import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useDrawChannel } from "@/hooks/use-draw-channel";
import type { DrawEvent, StrokePoint } from "@/lib/game-types";
import { Eraser, Pencil, Trash2, Undo2 } from "lucide-react";

export interface DrawCanvasHandle {
  clear: () => void;
}

interface Props {
  code: string;
  canDraw: boolean;
  drawerId: string | null;
}

interface CompletedStroke {
  color: string;
  size: number;
  tool: "pen" | "eraser";
  points: StrokePoint[];
}

const COLORS = [
  "#0F172A",
  "#FFFFFF",
  "#EF4444",
  "#F59E0B",
  "#10B981",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#92400E",
  "#475569",
];

const SIZES = [3, 6, 12, 22];

export const DrawCanvas = forwardRef<DrawCanvasHandle, Props>(function DrawCanvas(
  { code, canDraw, drawerId },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<CompletedStroke[]>([]);
  const currentRef = useRef<CompletedStroke | null>(null);
  const sizeRef = useRef({ w: 800, h: 600 });

  const [color, setColor] = useState("#0F172A");
  const [size, setSize] = useState(6);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");

  const send = useDrawChannel(code, (e: DrawEvent) => {
    if (e.type === "clear") {
      strokesRef.current = [];
      currentRef.current = null;
      redraw();
    } else if (e.type === "stroke") {
      strokesRef.current.push({
        color: e.color,
        size: e.size,
        tool: e.tool,
        points: e.points,
      });
      redraw();
    }
  });

  function redraw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, w, h);
    const all = currentRef.current
      ? [...strokesRef.current, currentRef.current]
      : strokesRef.current;
    for (const s of all) {
      drawStrokeOnCtx(ctx, s, w, h);
    }
    ctx.restore();
  }

  function drawStrokeOnCtx(
    ctx: CanvasRenderingContext2D,
    stroke: CompletedStroke,
    w: number,
    h: number,
  ) {
    if (stroke.points.length === 0) return;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = stroke.tool === "eraser" ? "#FFFFFF" : stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.beginPath();
    const p0 = stroke.points[0];
    ctx.moveTo(p0.x * w, p0.y * h);
    if (stroke.points.length === 1) {
      ctx.fillStyle = stroke.tool === "eraser" ? "#FFFFFF" : stroke.color;
      ctx.arc(p0.x * w, p0.y * h, stroke.size / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    for (let i = 1; i < stroke.points.length; i++) {
      const p = stroke.points[i];
      ctx.lineTo(p.x * w, p.y * h);
    }
    ctx.stroke();
  }

  // Resize
  useEffect(() => {
    function resize() {
      const wrap = wrapRef.current;
      const canvas = canvasRef.current;
      if (!wrap || !canvas) return;
      const rect = wrap.getBoundingClientRect();
      const w = Math.max(200, rect.width);
      const h = Math.max(200, (w * 3) / 4);
      sizeRef.current = { w, h };
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      redraw();
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Pointer handling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function getPoint(e: PointerEvent): StrokePoint {
      const rect = canvas!.getBoundingClientRect();
      const { w, h } = sizeRef.current;
      return {
        x: Math.max(0, Math.min(1, (e.clientX - rect.left) / w)),
        y: Math.max(0, Math.min(1, (e.clientY - rect.top) / h)),
      };
    }

    function down(e: PointerEvent) {
      if (!canDraw) return;
      e.preventDefault();
      canvas!.setPointerCapture(e.pointerId);
      currentRef.current = {
        color,
        size,
        tool,
        points: [getPoint(e)],
      };
      redraw();
    }
    function move(e: PointerEvent) {
      if (!currentRef.current) return;
      e.preventDefault();
      currentRef.current.points.push(getPoint(e));
      redraw();
    }
    function up(e: PointerEvent) {
      if (!currentRef.current) return;
      e.preventDefault();
      try {
        canvas!.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      const completed = currentRef.current;
      currentRef.current = null;
      strokesRef.current.push(completed);
      redraw();
      if (drawerId) {
        send({
          type: "stroke",
          color: completed.color,
          size: completed.size,
          tool: completed.tool,
          points: completed.points,
          drawerId,
        });
      }
    }
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("pointerleave", up);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("pointerleave", up);
    };
  }, [canDraw, color, size, tool, drawerId, send]);

  useImperativeHandle(ref, () => ({
    clear: () => {
      strokesRef.current = [];
      currentRef.current = null;
      redraw();
      if (drawerId) send({ type: "clear", drawerId });
    },
  }));

  function undo() {
    strokesRef.current.pop();
    redraw();
    // Best-effort: send a clear + replay
    if (drawerId) {
      send({ type: "clear", drawerId });
      for (const s of strokesRef.current) {
        send({
          type: "stroke",
          color: s.color,
          size: s.size,
          tool: s.tool,
          points: s.points,
          drawerId,
        });
      }
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={wrapRef}
        className="brutal-card overflow-hidden p-0"
        style={{ touchAction: "none" }}
      >
        <canvas
          ref={canvasRef}
          className="block bg-white"
          style={{ touchAction: "none" }}
          aria-label="Drawing canvas"
        />
      </div>

      {canDraw && (
        <div className="brutal-card-sm flex flex-wrap items-center gap-2 p-2 sm:p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                onClick={() => {
                  setColor(c);
                  setTool("pen");
                }}
                className={`h-7 w-7 rounded-md border-2 border-foreground transition-transform ${
                  color === c && tool === "pen"
                    ? "scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-card"
                    : ""
                }`}
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="mx-1 h-7 w-px bg-foreground/20" />
          <div className="flex items-center gap-1">
            {SIZES.map((s) => (
              <button
                key={s}
                type="button"
                aria-label={`Brush size ${s}`}
                onClick={() => setSize(s)}
                className={`flex h-7 w-7 items-center justify-center rounded-md border-2 border-foreground bg-card ${
                  size === s ? "bg-primary" : ""
                }`}
              >
                <span
                  className="block rounded-full bg-foreground"
                  style={{ width: s / 2 + 2, height: s / 2 + 2 }}
                />
              </button>
            ))}
          </div>
          <div className="mx-1 h-7 w-px bg-foreground/20" />
          <button
            type="button"
            onClick={() => setTool("pen")}
            aria-label="Pen tool"
            className={`flex h-9 items-center gap-1.5 rounded-md border-2 border-foreground px-2.5 text-sm font-bold ${
              tool === "pen" ? "bg-primary" : "bg-card"
            }`}
          >
            <Pencil className="h-4 w-4" /> Pen
          </button>
          <button
            type="button"
            onClick={() => setTool("eraser")}
            aria-label="Eraser tool"
            className={`flex h-9 items-center gap-1.5 rounded-md border-2 border-foreground px-2.5 text-sm font-bold ${
              tool === "eraser" ? "bg-primary" : "bg-card"
            }`}
          >
            <Eraser className="h-4 w-4" /> Eraser
          </button>
          <button
            type="button"
            onClick={undo}
            aria-label="Undo"
            className="flex h-9 items-center gap-1.5 rounded-md border-2 border-foreground bg-card px-2.5 text-sm font-bold"
          >
            <Undo2 className="h-4 w-4" /> Undo
          </button>
          <button
            type="button"
            onClick={() => {
              strokesRef.current = [];
              currentRef.current = null;
              redraw();
              if (drawerId) send({ type: "clear", drawerId });
            }}
            aria-label="Clear canvas"
            className="ml-auto flex h-9 items-center gap-1.5 rounded-md border-2 border-foreground bg-destructive px-2.5 text-sm font-bold text-destructive-foreground"
          >
            <Trash2 className="h-4 w-4" /> Clear
          </button>
        </div>
      )}
    </div>
  );
});
