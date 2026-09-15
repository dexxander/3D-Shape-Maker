import { Copy, Trash2 } from "lucide-react";
import type { SceneObject, Vec3 } from "@/lib/meshpad/types";

type Props = {
  object: SceneObject | null;
  onChange: (patch: Partial<SceneObject>) => void;
  onCommit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

const AXES: { key: 0 | 1 | 2; label: string }[] = [
  { key: 0, label: "X" },
  { key: 1, label: "Y" },
  { key: 2, label: "Z" },
];

function Row({
  title,
  value,
  min,
  max,
  step,
  onChange,
  onCommit,
  format,
}: {
  title: string;
  value: Vec3;
  min: number;
  max: number;
  step: number;
  onChange: (v: Vec3) => void;
  onCommit: () => void;
  format?: (n: number) => string;
}) {
  return (
    <fieldset className="rounded-2xl border border-border p-3">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      <div className="space-y-2">
        {AXES.map((a) => (
          <label
            key={a.label}
            className="grid grid-cols-[1.5rem_minmax(0,1fr)_3rem] items-center gap-2"
          >
            <span className="text-sm font-semibold text-muted-foreground">{a.label}</span>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={value[a.key]}
              aria-label={`${title} ${a.label}`}
              onChange={(e) => {
                const next = [...value] as Vec3;
                next[a.key] = Number(e.target.value);
                onChange(next);
              }}
              onPointerUp={onCommit}
              onKeyUp={onCommit}
              className="w-full accent-[var(--primary)]"
            />
            <span className="text-right text-xs tabular-nums text-muted-foreground">
              {(format ?? ((n: number) => n.toFixed(1)))(value[a.key])}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ObjectInspector({ object, onChange, onCommit, onDuplicate, onDelete }: Props) {
  if (!object) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Nothing selected. Click a shape in the 3D view, or pick one from the list above.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <h3 className="truncate font-display text-lg">{object.name}</h3>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onDuplicate}
            className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"
          >
            <Copy className="h-4 w-4" /> Duplicate
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1 rounded-xl border border-destructive/40 px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>

      <Row
        title="Move"
        value={object.position}
        min={-5}
        max={5}
        step={0.1}
        onChange={(position) => onChange({ position })}
        onCommit={onCommit}
      />
      <Row
        title="Rotate"
        value={object.rotation}
        min={-Math.PI}
        max={Math.PI}
        step={0.05}
        onChange={(rotation) => onChange({ rotation })}
        onCommit={onCommit}
        format={(n) => `${Math.round((n * 180) / Math.PI)}°`}
      />
      <Row
        title="Resize"
        value={object.scale}
        min={0.2}
        max={3}
        step={0.05}
        onChange={(scale) => onChange({ scale })}
        onCommit={onCommit}
      />

      <div className="rounded-2xl border border-border p-3">
        <label className="flex items-center gap-3 text-sm font-semibold">
          Mesh color
          <input
            type="color"
            value={object.color}
            onChange={(e) => onChange({ color: e.target.value })}
            onBlur={onCommit}
            className="h-9 w-16 cursor-pointer rounded-lg border border-border bg-background"
            aria-label="Mesh color"
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Mesh color presets">
          {["#ff8a5b", "#48b8a0", "#6a8cff", "#ffc857", "#e05c6e", "#8f7bd8", "#334155"].map(
            (color) => (
              <button
                key={color}
                type="button"
                onClick={() => {
                  onChange({ color });
                  onCommit();
                }}
                aria-label={`Set mesh color to ${color}`}
                className={`h-7 w-7 rounded-full border-2 ${
                  object.color.toLowerCase() === color ? "border-foreground" : "border-transparent"
                }`}
                style={{ backgroundColor: color }}
              />
            ),
          )}
        </div>
      </div>

      {object.kind === "sketch" && (
        <label className="grid grid-cols-[auto_minmax(0,1fr)_3rem] items-center gap-3 rounded-2xl border border-border p-3 text-sm font-semibold">
          <span>Depth</span>
          <input
            type="range"
            min="0.04"
            max="0.6"
            step="0.01"
            value={object.thickness ?? 0.16}
            onChange={(event) => onChange({ thickness: Number(event.target.value) })}
            onPointerUp={onCommit}
            onKeyUp={onCommit}
            className="w-full accent-[var(--primary)]"
            aria-label="Mesh depth"
          />
          <span className="text-right text-xs tabular-nums text-muted-foreground">
            {(object.thickness ?? 0.16).toFixed(2)}
          </span>
        </label>
      )}

      {object.kind === "extrude" && (
        <label className="grid grid-cols-[auto_minmax(0,1fr)_3rem] items-center gap-3 rounded-2xl border border-border p-3 text-sm font-semibold">
          <span>Depth</span>
          <input
            type="range"
            min="0.05"
            max="10"
            step="0.05"
            value={object.depth ?? 0.4}
            onChange={(event) => onChange({ depth: Number(event.target.value) })}
            onPointerUp={onCommit}
            onKeyUp={onCommit}
            className="w-full accent-[var(--primary)]"
            aria-label="Extrusion depth"
          />
          <span className="text-right text-xs tabular-nums text-muted-foreground">
            {(object.depth ?? 0.4).toFixed(2)}
          </span>
        </label>
      )}

      {object.holes && object.holes.length > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-border p-3 text-sm">
          <span className="font-semibold text-muted-foreground">Inner Holes</span>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
            {object.holes.length} {object.holes.length === 1 ? "hole" : "holes"}
          </span>
        </div>
      )}

      {object.cuts && object.cuts.length > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <div>
            <span className="font-semibold text-foreground">Carved Cuts</span>
            <span className="ml-2 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-bold text-destructive">
              {object.cuts.length}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              onChange({ cuts: [] });
              onCommit();
            }}
            className="rounded-xl border border-destructive/40 bg-background px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10"
          >
            Clear Cuts
          </button>
        </div>
      )}
    </div>
  );
}
