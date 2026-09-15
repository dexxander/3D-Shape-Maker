import { useState } from "react";
import { Layers } from "lucide-react";
import { DrawingPanel, CANVAS_SIZE } from "@/components/meshpad/DrawingPanel";
import { useHistory } from "@/lib/meshpad/useHistory";
import { isClosedOutline } from "@/lib/meshpad/geometry";
import type { Point, Stroke } from "@/lib/meshpad/types";

type Props = {
  /** Called once both outlines are closed and the user hits "Build 3D". */
  onBuild: (frontOutline: Point[], sideOutline: Point[]) => void;
};

/**
 * Two-canvas sketch input: a "Front" view (defines width per height) and
 * a "Side" view (defines depth per height), sharing the same canvas
 * pixel height so they line up on the vertical axis. Combining both
 * lets buildMultiViewGeometry() reconstruct width, height AND depth from
 * plain 2D drawings — no AI/ML, no external calls.
 */
export function MultiViewPanel({ onBuild }: Props) {
  const front = useHistory<Stroke[]>([]);
  const side = useHistory<Stroke[]>([]);
  const [activeView, setActiveView] = useState<"front" | "side">("front");
  const [error, setError] = useState<string | null>(null);

  const longestOf = (strokes: Stroke[]) =>
    strokes.reduce<Stroke | null>(
      (best, s) => (!best || s.points.length > best.points.length ? s : best),
      null,
    );

  const frontOutline = longestOf(front.state);
  const sideOutline = longestOf(side.state);
  const frontClosed = !!frontOutline && isClosedOutline(frontOutline.points, CANVAS_SIZE);
  const sideClosed = !!sideOutline && isClosedOutline(sideOutline.points, CANVAS_SIZE);
  const readyToBuild = frontClosed && sideClosed;

  const handleBuild = () => {
    if (!frontClosed || !sideClosed) {
      setError("Draw and close both the Front and Side outlines before building.");
      return;
    }
    setError(null);
    onBuild(frontOutline!.points, sideOutline!.points);
    front.reset([]);
    side.reset([]);
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-5">
      <header className="flex items-center gap-2">
        <Layers className="h-5 w-5 text-primary" />
        <div>
          <h2 className="font-display text-xl">Sketch from two views</h2>
          <p className="text-sm text-muted-foreground">
            Draw the shape from the front, then from the side. Both use the same height axis, so
            together they define width, height AND depth.
          </p>
        </div>
      </header>

      <div className="mt-4 flex gap-2">
        <ViewTab
          label="Front view"
          active={activeView === "front"}
          done={frontClosed}
          onClick={() => setActiveView("front")}
        />
        <ViewTab
          label="Side view"
          active={activeView === "side"}
          done={sideClosed}
          onClick={() => setActiveView("side")}
        />
      </div>

      <div className="mt-4">
        {activeView === "front" ? (
          <DrawingPanel
            strokes={front.state}
            onStrokesChange={front.set}
            onUndo={front.undo}
            onRedo={front.redo}
            canUndo={front.canUndo}
            canRedo={front.canRedo}
            onExtrude={() => setActiveView("side")}
            title="Front view"
            description="Outline the shape as seen from the front — this sets its width at each height."
            actionLabel="Looks good → Draw side view"
          />
        ) : (
          <DrawingPanel
            strokes={side.state}
            onStrokesChange={side.set}
            onUndo={side.undo}
            onRedo={side.redo}
            canUndo={side.canUndo}
            canRedo={side.canRedo}
            onExtrude={handleBuild}
            title="Side view"
            description="Outline the shape as seen from the side — this sets its depth at each height."
            actionLabel="Build 3D shape →"
          />
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {!error && (
        <p className="mt-3 text-xs text-muted-foreground">
          {frontClosed ? "Front ✓" : "Front: draw a closed outline"} ·{" "}
          {sideClosed ? "Side ✓" : "Side: draw a closed outline"}
        </p>
      )}

      {readyToBuild && activeView === "front" && (
        <button
          type="button"
          onClick={handleBuild}
          className="mt-3 w-full rounded-2xl bg-primary px-4 py-3 text-base font-semibold text-primary-foreground shadow-soft transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Build 3D shape →
        </button>
      )}
    </section>
  );
}

function ViewTab({
  label,
  active,
  done,
  onClick,
}: {
  label: string;
  active: boolean;
  done: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-background text-foreground hover:bg-muted"
      }`}
    >
      {label}
      {done && <span className="text-success">✓</span>}
    </button>
  );
}