import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, Pencil, Redo2, Trash2, Undo2, Shapes } from "lucide-react";
import type { Point, Stroke } from "@/lib/meshpad/types";
import { uid } from "@/lib/meshpad/types";
import { isClosedOutline } from "@/lib/meshpad/geometry";

export const CANVAS_SIZE = 600;

type Props = {
  strokes: Stroke[];
  onStrokesChange: (strokes: Stroke[], options?: { history?: boolean }) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onExtrude: (outline: Point[]) => void;
};

const ERASER_RADIUS = 18;

/** Remove points near the eraser, splitting strokes into remaining segments. */
function eraseAt(strokes: Stroke[], p: Point): Stroke[] {
  const out: Stroke[] = [];
  for (const s of strokes) {
    let current: Point[] = [];
    for (const pt of s.points) {
      if (Math.hypot(pt.x - p.x, pt.y - p.y) <= ERASER_RADIUS) {
        if (current.length > 2) out.push({ id: uid(), points: current });
        current = [];
      } else {
        current.push(pt);
      }
    }
    if (current.length > 2) out.push({ id: current === s.points ? s.id : uid(), points: current });
  }
  return out;
}

export function DrawingPanel({
  strokes,
  onStrokesChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onExtrude,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<"draw" | "erase">("draw");
  const [error, setError] = useState<string | null>(null);
  const drawing = useRef(false);
  const liveStroke = useRef<Point[]>([]);

  const paint = useCallback(
    (list: Stroke[]) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "#e6edf2";
      ctx.lineWidth = 1;
      for (let i = 50; i < canvas.width; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
      }

      ctx.strokeStyle = "#e0393e";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const all = liveStroke.current.length
        ? [...list, { id: "live", points: liveStroke.current }]
        : list;
      for (const s of all) {
        if (s.points.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(s.points[0]!.x, s.points[0]!.y);
        for (const p of s.points.slice(1)) ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    },
    [],
  );

  useEffect(() => {
    paint(strokes);
  }, [strokes, paint]);

  const toCanvas = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS_SIZE,
      y: ((e.clientY - rect.top) / rect.height) * CANVAS_SIZE,
    };
  };

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    setError(null);
    const p = toCanvas(e);
    if (tool === "erase") {
      onStrokesChange(eraseAt(strokes, p));
    } else {
      liveStroke.current = [p];
      paint(strokes);
    }
  };

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const p = toCanvas(e);
    if (tool === "erase") {
      onStrokesChange(eraseAt(strokes, p), { history: false });
      return;
    }
    const last = liveStroke.current[liveStroke.current.length - 1];
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < 2.5) return;
    liveStroke.current.push(p);
    paint(strokes);
  };

  const handleUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (tool === "draw" && liveStroke.current.length > 2) {
      onStrokesChange([...strokes, { id: uid(), points: liveStroke.current }]);
    }
    liveStroke.current = [];
  };

  const longest = strokes.reduce<Stroke | null>(
    (best, s) => (!best || s.points.length > best.points.length ? s : best),
    null,
  );
  const closed = !!longest && isClosedOutline(longest.points, CANVAS_SIZE);

  const handleExtrude = () => {
    if (!longest) {
      setError("Draw a shape first — try a circle, a star or a heart.");
      return;
    }
    if (!closed) {
      setError("Your outline isn't closed yet. Finish the line back where you started.");
      return;
    }
    setError(null);
    onExtrude(longest.points);
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h2 className="font-display truncate text-xl">1. Draw a shape</h2>
          <p className="text-sm text-muted-foreground">Draw one closed outline, then press Make 3D.</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
            closed ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
          }`}
        >
          {closed ? "Closed ✓" : "Open outline"}
        </span>
      </header>

      <div className="mt-4 flex flex-wrap gap-2">
        <ToolButton active={tool === "draw"} onClick={() => setTool("draw")} label="Draw (red)">
          <Pencil className="h-4 w-4" /> Draw
        </ToolButton>
        <ToolButton active={tool === "erase"} onClick={() => setTool("erase")} label="Eraser">
          <Eraser className="h-4 w-4" /> Erase
        </ToolButton>
        <ToolButton onClick={onUndo} disabled={!canUndo} label="Undo drawing">
          <Undo2 className="h-4 w-4" /> Undo
        </ToolButton>
        <ToolButton onClick={onRedo} disabled={!canRedo} label="Redo drawing">
          <Redo2 className="h-4 w-4" /> Redo
        </ToolButton>
        <ToolButton onClick={() => onStrokesChange([])} label="Clear the drawing">
          <Trash2 className="h-4 w-4" /> Clear
        </ToolButton>
      </div>

      <div className="relative mt-4 overflow-hidden rounded-2xl border border-border">
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          role="img"
          aria-label="Drawing canvas"
          className="block aspect-square w-full touch-none bg-white"
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
        />
        {strokes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center">
            <div className="text-muted-foreground">
              <Shapes className="mx-auto h-10 w-10 opacity-50" />
              <p className="mt-2 font-semibold">Your canvas is empty</p>
              <p className="text-sm">Draw a closed shape with your finger or mouse.</p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleExtrude}
        className="mt-4 w-full rounded-2xl bg-primary px-4 py-3 text-base font-semibold text-primary-foreground shadow-soft transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Make 3D →
      </button>
    </section>
  );
}

function ToolButton({
  children,
  active,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-40 ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-background text-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}
