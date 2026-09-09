import { useEffect, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import type { Point, SketchEdit } from "@/lib/meshpad/types";

type Operation = "add" | "delete";

type Props = {
  onAdd: (stroke: Point[]) => void;
  onDelete: (stroke: Point[]) => void;
  onClear: () => void;
  edits: SketchEdit[];
};

export const SKETCH_WIDTH = 600;
export const SKETCH_HEIGHT = 360;

export function SketchEditPanel({ onAdd, onDelete, onClear, edits }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [operation, setOperation] = useState<Operation>("add");
  const [stroke, setStroke] = useState<Point[]>([]);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#e6edf2";
    ctx.lineWidth = 1;
    for (let x = 40; x < canvas.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 40; y < canvas.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    for (const edit of edits) {
      if (edit.points.length < 2) continue;
      ctx.strokeStyle =
        edit.operation === "add" ? "rgba(62, 159, 112, 0.3)" : "rgba(155, 107, 179, 0.3)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(edit.points[0]!.x, edit.points[0]!.y);
      for (const point of edit.points.slice(1)) ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
    if (stroke.length < 2) return;
    ctx.strokeStyle = operation === "add" ? "#3e9f70" : "#9b6bb3";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(stroke[0]!.x, stroke[0]!.y);
    for (const point of stroke.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }, [operation, stroke]);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * SKETCH_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * SKETCH_HEIGHT,
    };
  };

  const finish = () => {
    if (stroke.length > 1) {
      if (operation === "add") onAdd(stroke);
      else onDelete(stroke);
    }
    drawing.current = false;
    setStroke([]);
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">1. Sketch a mesh edit</h2>
          <p className="text-sm text-muted-foreground">
            Sketch parts to add, or mark a region to delete. Repeat edits to build the object.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
            operation === "add" ? "bg-success/15 text-success" : "bg-purple-100 text-purple-700"
          }`}
        >
          {operation}
        </span>
      </header>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOperation("add")}
          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${
            operation === "add"
              ? "border-success bg-success/10 text-success"
              : "border-border hover:bg-muted"
          }`}
        >
          <Plus className="h-4 w-4" /> ADD
        </button>
        <button
          type="button"
          onClick={() => setOperation("delete")}
          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${
            operation === "delete"
              ? "border-purple-300 bg-purple-100 text-purple-700"
              : "border-border hover:bg-muted"
          }`}
        >
          <Minus className="h-4 w-4" /> DEL
        </button>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"
        >
          <RotateCcw className="h-4 w-4" /> Clear mesh
        </button>
      </div>

      <div className="relative mt-4 overflow-hidden rounded-2xl border border-border">
        <canvas
          ref={canvasRef}
          width={SKETCH_WIDTH}
          height={SKETCH_HEIGHT}
          className="block aspect-[5/3] w-full touch-none bg-white"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            drawing.current = true;
            setStroke([pointFromEvent(event)]);
          }}
          onPointerMove={(event) => {
            if (!drawing.current) return;
            const point = pointFromEvent(event);
            setStroke((current) => {
              const last = current[current.length - 1];
              return last && Math.hypot(point.x - last.x, point.y - last.y) < 3
                ? current
                : [...current, point];
            });
          }}
          onPointerUp={finish}
          onPointerCancel={finish}
          aria-label="Sketch edit canvas"
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <p>Green strokes add geometry. Purple strokes delete nearby generated parts.</p>
        <p className="font-semibold">
          {edits.length} sketch edit{edits.length === 1 ? "" : "s"} saved for reference
        </p>
      </div>
    </section>
  );
}
