import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Rotate3d, RotateCcw } from "lucide-react";
import type { Point, SketchEdit, Vec3 } from "@/lib/meshpad/types";

type Operation = "add" | "delete";

type Props = {
  onAdd: (stroke: Point[], rotation: Vec3, depthStroke: boolean, color: string) => void;
  onDelete: (stroke: Point[]) => void;
  onClear: () => void;
  edits: SketchEdit[];
};

export const SKETCH_WIDTH = 900;
export const SKETCH_HEIGHT = 540;

function projectPoint(point: Point, rotation: Vec3): Point {
  const centerX = SKETCH_WIDTH / 2;
  const centerY = SKETCH_HEIGHT / 2;
  const cosX = Math.cos(rotation[0]);
  const cosY = Math.cos(rotation[1]);
  const cosZ = Math.cos(rotation[2]);
  const sinZ = Math.sin(rotation[2]);

  // Keep the paper fixed while applying an orthographic approximation to the
  // drawing itself. X/Y rotation becomes visible as foreshortening, and Z
  // rotation behaves like a normal 2D rotation around the sketch center.
  const compressedX = (point.x - centerX) * cosY;
  const compressedY = (point.y - centerY) * cosX;
  return {
    x: centerX + compressedX * cosZ - compressedY * sinZ,
    y: centerY + compressedX * sinZ + compressedY * cosZ,
  };
}

function isEdgeOn(rotation: Vec3) {
  return Math.abs(Math.cos(rotation[0])) < 0.18 || Math.abs(Math.cos(rotation[1])) < 0.18;
}

function unprojectPoint(point: Point, rotation: Vec3): Point {
  const centerX = SKETCH_WIDTH / 2;
  const centerY = SKETCH_HEIGHT / 2;
  const rawCosX = Math.cos(rotation[0]);
  const rawCosY = Math.cos(rotation[1]);
  const cosZ = Math.cos(rotation[2]);
  const sinZ = Math.sin(rotation[2]);

  // Convert the screen pointer back into the drawing's local coordinates so
  // new strokes follow the currently rotated drawing plane.
  const screenX = point.x - centerX;
  const screenY = point.y - centerY;
  const rotatedX = screenX * cosZ + screenY * sinZ;
  const rotatedY = -screenX * sinZ + screenY * cosZ;
  return {
    x: Math.abs(rawCosY) < 0.18 ? centerX : centerX + rotatedX / rawCosY,
    y: Math.abs(rawCosX) < 0.18 ? centerY : centerY + rotatedY / rawCosX,
  };
}

function drawPlaneGuide(ctx: CanvasRenderingContext2D, rotation: Vec3, depthAnchor: Point | null) {
  const inset = 36;
  const corners = [
    { x: inset, y: inset },
    { x: SKETCH_WIDTH - inset, y: inset },
    { x: SKETCH_WIDTH - inset, y: SKETCH_HEIGHT - inset },
    { x: inset, y: SKETCH_HEIGHT - inset },
  ].map((point) => projectPoint(point, rotation));

  ctx.save();
  ctx.strokeStyle = "rgba(62, 159, 112, 0.5)";
  ctx.fillStyle = "rgba(62, 159, 112, 0.05)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(corners[0]!.x, corners[0]!.y);
  for (const point of corners.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const center = projectPoint({ x: SKETCH_WIDTH / 2, y: SKETCH_HEIGHT / 2 }, rotation);
  const horizontalStart = projectPoint({ x: inset, y: SKETCH_HEIGHT / 2 }, rotation);
  const horizontalEnd = projectPoint({ x: SKETCH_WIDTH - inset, y: SKETCH_HEIGHT / 2 }, rotation);
  const verticalStart = projectPoint({ x: SKETCH_WIDTH / 2, y: inset }, rotation);
  const verticalEnd = projectPoint({ x: SKETCH_WIDTH / 2, y: SKETCH_HEIGHT - inset }, rotation);
  ctx.strokeStyle = "rgba(62, 159, 112, 0.35)";
  ctx.beginPath();
  ctx.moveTo(horizontalStart.x, horizontalStart.y);
  ctx.lineTo(horizontalEnd.x, horizontalEnd.y);
  ctx.moveTo(verticalStart.x, verticalStart.y);
  ctx.lineTo(verticalEnd.x, verticalEnd.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#3e9f70";
  ctx.beginPath();
  ctx.arc(center.x, center.y, 4, 0, Math.PI * 2);
  ctx.fill();

  const projectedXStart = projectPoint(
    { x: SKETCH_WIDTH / 2 - 90, y: SKETCH_HEIGHT / 2 },
    rotation,
  );
  const projectedXEnd = projectPoint({ x: SKETCH_WIDTH / 2 + 90, y: SKETCH_HEIGHT / 2 }, rotation);
  const xLength = Math.hypot(
    projectedXEnd.x - projectedXStart.x,
    projectedXEnd.y - projectedXStart.y,
  );
  const xDepthDirection = {
    x: Math.sin(rotation[1]) * 54,
    y: -Math.sin(rotation[0]) * 54,
  };
  const edgeAnchor = depthAnchor ?? center;
  const xAxisStart =
    xLength < 10
      ? { x: edgeAnchor.x - xDepthDirection.x, y: edgeAnchor.y - xDepthDirection.y }
      : projectedXStart;
  const xAxisEnd =
    xLength < 10
      ? { x: edgeAnchor.x + xDepthDirection.x, y: edgeAnchor.y + xDepthDirection.y }
      : projectedXEnd;
  const axisColor = xLength < 10 ? "#e08b32" : "#3e9f70";
  const drawArrowHead = (tip: Point, tail: Point) => {
    const angle = Math.atan2(tip.y - tail.y, tip.x - tail.x);
    const size = 8;
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(
      tip.x - size * Math.cos(angle - Math.PI / 6),
      tip.y - size * Math.sin(angle - Math.PI / 6),
    );
    ctx.lineTo(
      tip.x - size * Math.cos(angle + Math.PI / 6),
      tip.y - size * Math.sin(angle + Math.PI / 6),
    );
    ctx.closePath();
    ctx.fill();
  };
  ctx.strokeStyle = axisColor;
  ctx.fillStyle = axisColor;
  ctx.lineWidth = 3;
  ctx.setLineDash(xLength < 10 ? [6, 5] : []);
  ctx.beginPath();
  ctx.moveTo(xAxisStart.x, xAxisStart.y);
  ctx.lineTo(xAxisEnd.x, xAxisEnd.y);
  ctx.stroke();
  drawArrowHead(xAxisStart, xAxisEnd);
  drawArrowHead(xAxisEnd, xAxisStart);
  ctx.setLineDash([]);
  ctx.font = "bold 14px sans-serif";
  ctx.fillText(xLength < 10 ? "X depth" : "X", xAxisEnd.x + 8, xAxisEnd.y - 8);
  if (xLength < 10 && depthAnchor) {
    ctx.strokeStyle = "rgba(224, 139, 50, 0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(edgeAnchor.x, edgeAnchor.y, 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawProjectedStroke(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  rotation: Vec3,
  color: string,
  width: number,
  depthCue: boolean,
  screenSpace = false,
) {
  if (points.length < 2) return;
  const projected = screenSpace ? points : points.map((point) => projectPoint(point, rotation));
  const depthOffset = {
    x: Math.sin(rotation[1]) * 34,
    y: -Math.sin(rotation[0]) * 34,
  };

  if (depthCue && (Math.abs(depthOffset.x) > 1 || Math.abs(depthOffset.y) > 1)) {
    ctx.strokeStyle = "rgba(48, 67, 82, 0.16)";
    ctx.lineWidth = width + 2;
    ctx.beginPath();
    ctx.moveTo(projected[0]!.x + depthOffset.x, projected[0]!.y + depthOffset.y);
    for (const point of projected.slice(1)) {
      ctx.lineTo(point.x + depthOffset.x, point.y + depthOffset.y);
    }
    ctx.stroke();

    ctx.strokeStyle = "rgba(48, 67, 82, 0.28)";
    ctx.lineWidth = Math.max(1, width * 0.45);
    for (
      let index = 0;
      index < projected.length;
      index += Math.max(1, Math.floor(projected.length / 12))
    ) {
      const point = projected[index]!;
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(point.x + depthOffset.x, point.y + depthOffset.y);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(projected[0]!.x, projected[0]!.y);
  for (const point of projected.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.stroke();
}

export function SketchEditPanel({ onAdd, onDelete, onClear, edits }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [operation, setOperation] = useState<Operation>("add");
  const [rotation, setRotation] = useState<Vec3>([0, 0, 0]);
  const [stroke, setStroke] = useState<Point[]>([]);
  const [penColor, setPenColor] = useState("#3e9f70");
  const [depthAnchor, setDepthAnchor] = useState<Point | null>(null);
  const drawing = useRef(false);
  const rotating = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });

  const resetRotation = () => setRotation([0, 0, 0]);

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
    drawPlaneGuide(ctx, rotation, depthAnchor);
    for (const edit of edits) {
      drawProjectedStroke(
        ctx,
        edit.points,
        rotation,
        edit.operation === "add"
          ? `${edit.color ?? "#3e9f70"}66`
          : "rgba(155, 107, 179, 0.3)",
        4,
        false,
        edit.depthStroke,
      );
    }
    drawProjectedStroke(
      ctx,
      stroke,
      rotation,
      operation === "add" ? penColor : "#9b6bb3",
      7,
      true,
      isEdgeOn(rotation),
    );
  }, [depthAnchor, edits, operation, penColor, rotation, stroke]);

  const screenPointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * SKETCH_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * SKETCH_HEIGHT,
    };
  };

  const edgeAnchorFromScreenPoint = (point: Point): Point => {
    const hiddenX = Math.abs(Math.cos(rotation[1])) < 0.18;
    return hiddenX ? { x: SKETCH_WIDTH / 2, y: point.y } : { x: point.x, y: SKETCH_HEIGHT / 2 };
  };

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const screenPoint = screenPointFromEvent(event);
    if (!isEdgeOn(rotation)) return unprojectPoint(screenPoint, rotation);
    const anchor = depthAnchor ?? edgeAnchorFromScreenPoint(screenPoint);
    const hiddenX = Math.abs(Math.cos(rotation[1])) < 0.18;
    return hiddenX ? { x: screenPoint.x, y: anchor.y } : { x: anchor.x, y: screenPoint.y };
  };

  const finish = () => {
    if (stroke.length > 1) {
      if (operation === "add") onAdd(stroke, rotation, isEdgeOn(rotation), penColor);
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

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-background p-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Rotate3d className="h-4 w-4 text-primary" />
          <span>3D drawing view</span>
          <span className="text-xs font-normal text-muted-foreground">
            X {Math.round((rotation[0] * 180) / Math.PI)}° · Y{" "}
            {Math.round((rotation[1] * 180) / Math.PI)}°
          </span>
        </div>
        <button
          type="button"
          onClick={resetRotation}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-bold hover:bg-muted"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset drawing
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Hold the right mouse button and drag to rotate the drawing. The grid stays fixed, and new
        strokes follow the rotated drawing plane. The orange X-depth arrow shows where to draw when
        the plane is edge-on.
      </p>

      <div className="mt-3 rounded-2xl border border-border bg-background p-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-semibold" htmlFor="sketch-pen-color">
            Marker color
          </label>
          <div
            className="relative h-9 w-24 overflow-hidden rounded-xl border border-border shadow-inner"
            style={{
              background:
                "linear-gradient(90deg, #fff 0%, transparent 45%), linear-gradient(135deg, #ef4444, #f59e0b, #22c55e, #3b82f6, #8b5cf6, #ec4899)",
            }}
          >
            <input
              id="sketch-pen-color"
              type="color"
              value={penColor}
              onChange={(event) => setPenColor(event.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Choose marker color"
            />
          </div>
          <span className="rounded-lg border border-border bg-card px-2 py-1 font-mono text-xs uppercase">
            {penColor}
          </span>
          <div className="flex flex-wrap gap-1.5" aria-label="Primary marker colors">
            {[
              ["Red", "#ef4444"],
              ["Yellow", "#f59e0b"],
              ["Green", "#22c55e"],
              ["Blue", "#3b82f6"],
              ["Purple", "#8b5cf6"],
              ["Pink", "#ec4899"],
            ].map(([name, color]) => (
              <button
                key={color}
                type="button"
                onClick={() => setPenColor(color)}
                aria-label={`Use ${name} marker`}
                aria-pressed={penColor.toLowerCase() === color}
                className={`h-7 w-7 rounded-full border-2 transition hover:scale-110 ${
                  penColor.toLowerCase() === color
                    ? "border-foreground ring-2 ring-ring/30"
                    : "border-card"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Pick any shade from the gradient color control, or choose a primary preset.
        </p>
      </div>

      <div className="relative mt-4 min-h-[360px] overflow-hidden rounded-2xl border border-border bg-slate-100 sm:min-h-[520px]">
        <canvas
          ref={canvasRef}
          width={SKETCH_WIDTH}
          height={SKETCH_HEIGHT}
          className="block h-[360px] w-full touch-none bg-white sm:h-[520px]"
          onPointerDown={(event) => {
            if (event.button === 2) {
              event.preventDefault();
              rotating.current = true;
              lastPointer.current = { x: event.clientX, y: event.clientY };
              event.currentTarget.setPointerCapture(event.pointerId);
              return;
            }
            if (isEdgeOn(rotation)) {
              setDepthAnchor(edgeAnchorFromScreenPoint(screenPointFromEvent(event)));
            }
            event.currentTarget.setPointerCapture(event.pointerId);
            drawing.current = true;
            setStroke([pointFromEvent(event)]);
          }}
          onPointerMove={(event) => {
            if (rotating.current) {
              const dx = event.clientX - lastPointer.current.x;
              const dy = event.clientY - lastPointer.current.y;
              lastPointer.current = { x: event.clientX, y: event.clientY };
              setRotation((current) => [
                Math.max(-Math.PI / 2, Math.min(Math.PI / 2, current[0] + dy * 0.012)),
                Math.max(-Math.PI / 2, Math.min(Math.PI / 2, current[1] + dx * 0.012)),
                current[2],
              ]);
              return;
            }
            if (!drawing.current) {
              if (isEdgeOn(rotation)) {
                setDepthAnchor(edgeAnchorFromScreenPoint(screenPointFromEvent(event)));
              }
              return;
            }
            const point = pointFromEvent(event);
            setStroke((current) => {
              const last = current[current.length - 1];
              return last && Math.hypot(point.x - last.x, point.y - last.y) < 3
                ? current
                : [...current, point];
            });
          }}
          onPointerUp={(event) => {
            if (rotating.current) {
              rotating.current = false;
              event.currentTarget.releasePointerCapture(event.pointerId);
              return;
            }
            finish();
          }}
          onPointerCancel={(event) => {
            rotating.current = false;
            finish();
          }}
          onContextMenu={(event) => event.preventDefault()}
          aria-label="Sketch edit canvas"
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <p>The selected marker color adds geometry. Purple strokes delete nearby generated parts.</p>
        <p className="font-semibold">
          {edits.length} sketch edit{edits.length === 1 ? "" : "s"} saved for reference
        </p>
      </div>
    </section>
  );
}
