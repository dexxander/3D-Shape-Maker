import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, Pencil, Redo2, Trash2, Undo2, Shapes } from "lucide-react";
import type { Point, Stroke } from "@/lib/meshpad/types";
import { uid } from "@/lib/meshpad/types";
import { isClosedOutline, isOutlineInside, snapToAngle } from "@/lib/meshpad/geometry";

export const CANVAS_SIZE = 600;

type Props = {
  strokes: Stroke[];
  onStrokesChange: (strokes: Stroke[], options?: { history?: boolean }) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onExtrude: (outline: Point[], holes?: Point[][]) => void;
  title?: string;
  description?: string;
  actionLabel?: string;
  showAction?: boolean;
  /** Allow rough/open strokes for AI interpretation instead of requiring a closed outline. */
  allowOpen?: boolean;
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

function getStrokeBounds(pts: Point[]) {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, maxX, minY, maxY, area: Math.max(1, (maxX - minX) * (maxY - minY)) };
}

function analyzeStrokes(strokesList: Stroke[]) {
  const closed = strokesList.filter((s) => isClosedOutline(s.points, CANVAS_SIZE));
  if (closed.length === 0) return { outer: null, holes: [] as Stroke[] };
  const sorted = [...closed].sort((a, b) => {
    return getStrokeBounds(b.points).area - getStrokeBounds(a.points).area;
  });
  const outer = sorted[0]!;
  const holes = sorted.slice(1).filter((s) => isOutlineInside(s.points, outer.points));
  return { outer, holes };
}

export function DrawingPanel({
  strokes,
  onStrokesChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onExtrude,
  title = "1. Draw a shape",
  description = "Draw a closed radial profile, then revolve it into 3D.",
  actionLabel = "Revolve 3D →",
  showAction = true,
  allowOpen = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<"draw" | "erase">("draw");
  const [error, setError] = useState<string | null>(null);
  const [shiftHeld, setShiftHeld] = useState(false);
  const drawing = useRef(false);
  const liveStroke = useRef<Point[]>([]);
  const anchorPointRef = useRef<Point | null>(null);
  const lastSnapAngleRef = useRef<number | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftHeld(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftHeld(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const paint = useCallback((list: Stroke[]) => {
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

    const { outer, holes } = analyzeStrokes(list);
    const holeIds = new Set(holes.map((h) => h.id));

    // Render hole shapes with distinct cutout style
    for (const hole of holes) {
      if (hole.points.length < 2) continue;
      ctx.fillStyle = "rgba(224, 242, 254, 0.6)";
      ctx.beginPath();
      ctx.moveTo(hole.points[0]!.x, hole.points[0]!.y);
      for (const p of hole.points.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.closePath();
      ctx.fill();

      ctx.save();
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = "#0284c7";
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
    }

    // Render standard strokes & live stroke
    ctx.strokeStyle = "#e0393e";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const s of list) {
      if (holeIds.has(s.id) || s.points.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(s.points[0]!.x, s.points[0]!.y);
      for (const p of s.points.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }

    if (liveStroke.current.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(liveStroke.current[0]!.x, liveStroke.current[0]!.y);
      for (const p of liveStroke.current.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();

      // If angle snapping with shift, draw a dashed guide ray
      if (anchorPointRef.current && lastSnapAngleRef.current !== null) {
        const last = liveStroke.current[liveStroke.current.length - 1]!;
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(anchorPointRef.current.x, anchorPointRef.current.y);
        ctx.lineTo(last.x, last.y);
        ctx.stroke();

        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.roundRect(last.x + 12, last.y - 12, 48, 22, 6);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${lastSnapAngleRef.current}°`, last.x + 36, last.y - 1);
        ctx.restore();
      }
    }
  }, []);

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
      anchorPointRef.current = p;
      lastSnapAngleRef.current = null;
      liveStroke.current = [p];
      paint(strokes);
    }
  };

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    let p = toCanvas(e);
    if (tool === "erase") {
      onStrokesChange(eraseAt(strokes, p), { history: false });
      return;
    }
    const isShift = e.shiftKey || shiftHeld;
    if (isShift && anchorPointRef.current) {
      const snapped = snapToAngle(p, anchorPointRef.current, 45);
      p = snapped.point;
      lastSnapAngleRef.current = snapped.angleDegrees;
    } else {
      anchorPointRef.current = p;
      lastSnapAngleRef.current = null;
    }
    const last = liveStroke.current[liveStroke.current.length - 1];
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < 2.5) return;
    liveStroke.current.push(p);
    paint(strokes);
  };

  const handleUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    anchorPointRef.current = null;
    lastSnapAngleRef.current = null;
    if (tool === "draw" && liveStroke.current.length > 2) {
      onStrokesChange([...strokes, { id: uid(), points: liveStroke.current }]);
    }
    liveStroke.current = [];
  };

  const { outer, holes } = analyzeStrokes(strokes);
  const closed = !!outer && isClosedOutline(outer.points, CANVAS_SIZE);
  const longestStroke = strokes.reduce<Stroke | null>(
    (best, stroke) => (!best || stroke.points.length > best.points.length ? stroke : best),
    null,
  );
  const primaryStroke = allowOpen ? longestStroke : outer;

  const handleExtrude = () => {
    if (!primaryStroke) {
      setError("Draw something first so the AI can understand it.");
      return;
    }
    if (!allowOpen && !closed) {
      setError("Your outline isn't closed yet. Finish the line back where you started.");
      return;
    }
    setError(null);
    onExtrude(
      primaryStroke.points,
      allowOpen ? [] : holes.map((h) => h.points),
    );
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h2 className="font-display truncate text-xl">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          {shiftHeld && (
            <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
              Shift: 45° Snap ON
            </span>
          )}
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
              closed ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
            }`}
          >
            {closed
              ? holes.length > 0
                ? `Closed ✓ (${holes.length} Hole${holes.length > 1 ? "s" : ""})`
                : "Closed ✓"
              : "Open outline"}
          </span>
        </div>
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

      <div className="mt-2 flex flex-wrap items-center justify-between gap-1 px-1 text-xs text-muted-foreground">
        <span>💡 Hold <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground">Shift</kbd> to snap lines to 45°/90°</span>
        <span>Draw inside a shape to cut holes</span>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {showAction && (
        <button
          type="button"
          onClick={handleExtrude}
          className="mt-4 w-full rounded-2xl bg-primary px-4 py-3 text-base font-semibold text-primary-foreground shadow-soft transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {actionLabel}
        </button>
      )}
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
