import { Box, Circle, Cone, Cylinder } from "lucide-react";
import type { ShapeKind } from "@/lib/meshpad/types";

const SHAPES: { kind: ShapeKind; label: string; icon: React.ReactNode }[] = [
  { kind: "cube", label: "Cube", icon: <Box className="h-5 w-5" /> },
  { kind: "sphere", label: "Sphere", icon: <Circle className="h-5 w-5" /> },
  { kind: "cylinder", label: "Cylinder", icon: <Cylinder className="h-5 w-5" /> },
  { kind: "cone", label: "Cone", icon: <Cone className="h-5 w-5" /> },
];

export function ShapeLibrary({ onAdd }: { onAdd: (kind: ShapeKind) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {SHAPES.map((s) => (
        <button
          key={s.kind}
          type="button"
          onClick={() => onAdd(s.kind)}
          className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-background px-3 py-3 text-sm font-semibold transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {s.icon}
          {s.label}
        </button>
      ))}
    </div>
  );
}
