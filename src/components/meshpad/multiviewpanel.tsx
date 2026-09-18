import { useState } from "react";
import { BrainCircuit } from "lucide-react";
import { DrawingPanel, CANVAS_SIZE } from "@/components/meshpad/DrawingPanel";
import { useHistory } from "@/lib/meshpad/useHistory";
import { analyzeShape } from "@/lib/analyze-shape.functions";
import type { Point, Stroke } from "@/lib/meshpad/types";

export type ShapeAnalysis = {
  source: "gemini" | "fallback";
  aiError?: string;
  objectType: string;
  parts: ShapePartPlan[];
  width: number;
  height: number;
  depth: number;
  form: "extrude" | "revolve";
  confidence: number;
  explanation: string;
};

export type ShapePartPlan = {
  name: string;
  kind: "cube" | "sphere" | "cylinder" | "cone" | "roof" | "extrude";
  scale: [number, number, number];
  position: [number, number, number];
  rotation: [number, number, number];
  color: string;
};

type Props = { onBuild: (outline: Point[], analysis: ShapeAnalysis) => void };

/** A single front sketch. AI estimates the missing depth; Three.js builds the mesh. */
export function MultiViewPanel({ onBuild }: Props) {
  const drawing = useHistory<Stroke[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const outline = drawing.state.reduce<Stroke | null>(
    (best, stroke) => (!best || stroke.points.length > best.points.length ? stroke : best), null,
  );
  const hasDrawing = !!outline;

  const drawingImage = (strokes: Stroke[]) => {
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare the drawing image.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    context.strokeStyle = "#111827";
    context.lineWidth = 5;
    context.lineJoin = "round";
    context.lineCap = "round";
    strokes.forEach((stroke) => {
      if (stroke.points.length < 2) return;
      context.beginPath();
      stroke.points.forEach((point, index) => {
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.stroke();
    });
    return canvas.toDataURL("image/png");
  };

  const handleBuild = async () => {
    if (busy) return;
    if (!outline) {
      setError("Draw something first so the AI can understand it.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const analysis = await analyzeShape({ data: {
          points: outline.points,
          imageData: drawingImage(drawing.state),
          canvasSize: CANVAS_SIZE,
        } });
      onBuild(outline.points, analysis);
      if (analysis.source === "fallback") {
        setError(`Gemini was not used: ${analysis.aiError ?? analysis.explanation}`);
      }
      drawing.reset([]);
    } catch {
      const xs = outline.points.map((point) => point.x);
      const ys = outline.points.map((point) => point.y);
      const width = Math.max(...xs) - Math.min(...xs);
      const height = Math.max(...ys) - Math.min(...ys);
      onBuild(outline.points, {
        source: "fallback",
        aiError: "The Gemini request could not be completed.",
        objectType: "unknown object",
        parts: [{
          name: "Main silhouette",
          kind: "extrude",
          scale: [1, 1, 1],
          position: [0, 0.8, 0],
          rotation: [0, 0, 0],
          color: "#6a8cff",
        }],
        width, height, depth: Math.max(width * 0.55, 80), form: "extrude", confidence: 0.35,
        explanation: "AI was unavailable, so depth was estimated from the front silhouette.",
      });
      drawing.reset([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-5">
      <header className="flex items-center gap-2">
        <BrainCircuit className="h-5 w-5 text-primary" />
        <div>
          <h2 className="font-display text-xl">Draw one view, build 3D</h2>
          <p className="text-sm text-muted-foreground">Draw one object. Gemini identifies it and creates an editable 3D plan from simple parts like bodies, roofs, wheels, and stems.</p>
        </div>
      </header>
      <div className="mt-4">
        <DrawingPanel
          strokes={drawing.state} onStrokesChange={drawing.set} onUndo={drawing.undo} onRedo={drawing.redo}
          canUndo={drawing.canUndo} canRedo={drawing.canRedo} onExtrude={handleBuild} allowOpen
          title="Front silhouette"
          description="Close the outline around the object. Gemini will recognize what you drew and assemble a simple editable 3D version."
          actionLabel={busy ? "AI is reading the shape…" : "Ask AI → Build 3D"}
        />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{hasDrawing ? "Drawing ✓ — ready for AI analysis" : "Draw any object, open or closed"}</p>
      {error && <p role="alert" className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
    </section>
  );
}
