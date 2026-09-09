import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FilePlus2, Grid3x3, RotateCcw, Save, Trash2, Undo2, Redo2 } from "lucide-react";
import { Viewer3D } from "@/components/meshpad/Viewer3D";
import { SketchEditPanel, SKETCH_HEIGHT, SKETCH_WIDTH } from "@/components/meshpad/SketchEditPanel";
import { ShapeLibrary } from "@/components/meshpad/ShapeLibrary";
import { ObjectInspector } from "@/components/meshpad/ObjectInspector";
import { Onboarding } from "@/components/meshpad/Onboarding";
import { useHistory } from "@/lib/meshpad/useHistory";
import { makeObject } from "@/lib/meshpad/geometry";
import { downloadText, toOBJ, toSTL } from "@/lib/meshpad/exporters";
import { lastProjectId, loadProject, saveProject } from "@/lib/meshpad/storage";
import type {
  Point,
  SceneObject,
  SceneState,
  ShapeKind,
  SketchEdit,
  Stroke,
} from "@/lib/meshpad/types";
import { emptyScene, uid } from "@/lib/meshpad/types";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "MeshPad Lite — Draw a shape, turn it into 3D" },
      {
        name: "description",
        content:
          "A friendly browser 3D studio for families: draw a closed outline, extrude it into a mesh, edit shapes and export OBJ or STL.",
      },
      { property: "og:title", content: "MeshPad Lite — Draw a shape, turn it into 3D" },
      {
        property: "og:description",
        content:
          "Draw, extrude, edit and export 3D models right in your browser. No sign-up needed.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MeshPad,
});

/** Sample scene so the app is useful the moment it opens. */
function starterScene(): SceneState {
  const cube = makeObject("cube", 0);
  cube.position = [-1.4, 0.6, 0];
  const sphere = makeObject("sphere", 1);
  sphere.position = [1.4, 0.7, 0];
  const cone = makeObject("cone", 3);
  cone.position = [0, 0.75, -1.6];
  return { objects: [cube, sphere, cone], selectedId: cube.id };
}

function MeshPad() {
  const scene = useHistory<SceneState>(emptyScene());
  const drawing = useHistory<Stroke[]>([]);
  const [sketchEdits, setSketchEdits] = useState<SketchEdit[]>([]);
  const [wireframe, setWireframe] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [projectName, setProjectName] = useState("My first project");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(true);

  // Load the last saved project, or start with sample shapes.
  useEffect(() => {
    const id = lastProjectId();
    const saved = id ? loadProject(id) : null;
    if (saved) {
      scene.reset(saved.scene);
      drawing.reset(saved.strokes);
      setSketchEdits(saved.sketchEdits ?? []);
      setProjectName(saved.name);
      setProjectId(saved.id);
    } else {
      scene.reset(starterScene());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const objects = scene.state.objects;
  const selected = useMemo(
    () => objects.find((o) => o.id === scene.state.selectedId) ?? null,
    [objects, scene.state.selectedId],
  );

  const setScene = useCallback(
    (next: SceneState, options?: { history?: boolean }) => scene.set(next, options),
    [scene],
  );

  const addShape = (kind: ShapeKind, extra?: Partial<SceneObject>) => {
    const object = makeObject(kind, objects.length, extra);
    setScene({ objects: [...objects, object], selectedId: object.id });
    setStatus(`${object.name} added`);
  };

  const persistSnapshot = (nextScene: SceneState, nextEdits: SketchEdit[]) => {
    const saved = saveProject({
      id: projectId ?? undefined,
      name: projectName,
      scene: nextScene,
      strokes: drawing.state,
      sketchEdits: nextEdits,
    });
    setProjectId(saved.id);
  };

  const handleSketchAdd = (stroke: Point[]) => {
    const edit: SketchEdit = { id: uid(), operation: "add", points: stroke, createdAt: Date.now() };
    const nextEdits = [...sketchEdits, edit];
    if (stroke.length < 2) return;
    const additions: SceneObject[] = [
      makeObject("sketch", objects.length, {
        name: `Sketch part ${objects.length + 1}`,
        sketchPath: stroke,
        thickness: 0.16,
      }),
    ];
    const next = [...objects, ...additions];
    setSketchEdits(nextEdits);
    setScene({ objects: next, selectedId: additions[additions.length - 1]!.id });
    persistSnapshot({ objects: next, selectedId: additions[additions.length - 1]!.id }, nextEdits);
    setStatus("Added one continuous 3D mesh along the sketch.");
  };

  const handleSketchDelete = (stroke: Point[]) => {
    if (objects.length === 0) return;
    const edit: SketchEdit = {
      id: uid(),
      operation: "delete",
      points: stroke,
      createdAt: Date.now(),
    };
    const nextEdits = [...sketchEdits, edit];
    const minX = Math.min(...stroke.map((point) => point.x));
    const maxX = Math.max(...stroke.map((point) => point.x));
    const minY = Math.min(...stroke.map((point) => point.y));
    const maxY = Math.max(...stroke.map((point) => point.y));
    const remaining = objects.filter((object) => {
      const x = (object.position[0] / 4 + 0.5) * SKETCH_WIDTH;
      const y = ((1.5 - object.position[1]) / 3) * SKETCH_HEIGHT;
      return x < minX || x > maxX || y < minY || y > maxY;
    });
    const removed = objects.length - remaining.length;
    if (removed === 0) {
      setStatus("Draw a wider DEL region over the mesh part you want to remove.");
      return;
    }
    const nextScene = {
      objects: remaining,
      selectedId: remaining[remaining.length - 1]?.id ?? null,
    };
    setSketchEdits(nextEdits);
    setScene(nextScene);
    persistSnapshot(nextScene, nextEdits);
    setStatus(`Deleted ${removed} mesh part${removed === 1 ? "" : "s"}.`);
  };

  const patchSelected = (patch: Partial<SceneObject>, history = false) => {
    if (!selected) return;
    setScene(
      {
        ...scene.state,
        objects: objects.map((o) => (o.id === selected.id ? { ...o, ...patch } : o)),
      },
      { history },
    );
  };

  const commit = () => setScene(scene.state, { history: true });

  const duplicateSelected = () => {
    if (!selected) return;
    const copy: SceneObject = {
      ...selected,
      id: uid(),
      name: `${selected.name} copy`,
      position: [selected.position[0] + 0.8, selected.position[1], selected.position[2] + 0.4],
    };
    setScene({ objects: [...objects, copy], selectedId: copy.id });
  };

  const deleteSelected = useCallback(() => {
    if (!scene.state.selectedId) return;
    setScene({
      objects: objects.filter((o) => o.id !== scene.state.selectedId),
      selectedId: null,
    });
  }, [objects, scene.state.selectedId, setScene]);

  // Keyboard shortcuts: nudge with arrows, delete, undo/redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) scene.redo();
        else scene.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        scene.redo();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (scene.state.selectedId) {
          e.preventDefault();
          deleteSelected();
        }
        return;
      }
      const sel = objects.find((o) => o.id === scene.state.selectedId);
      if (!sel) return;
      const step = e.shiftKey ? 0.5 : 0.1;
      const map: Record<string, [number, number, number]> = {
        ArrowLeft: [-step, 0, 0],
        ArrowRight: [step, 0, 0],
        ArrowUp: [0, 0, -step],
        ArrowDown: [0, 0, step],
        PageUp: [0, step, 0],
        PageDown: [0, -step, 0],
      };
      const delta = map[e.key];
      if (!delta) return;
      e.preventDefault();
      setScene({
        ...scene.state,
        objects: objects.map((o) =>
          o.id === sel.id
            ? {
                ...o,
                position: [
                  o.position[0] + delta[0],
                  o.position[1] + delta[1],
                  o.position[2] + delta[2],
                ],
              }
            : o,
        ),
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [objects, scene, setScene, deleteSelected]);

  const newProject = () => {
    scene.reset(starterScene());
    drawing.reset([]);
    setSketchEdits([]);
    setProjectId(null);
    setProjectName("Untitled project");
    setStatus("New project started");
  };

  const clearAll = () => {
    scene.set(emptyScene());
    drawing.set([]);
    setSketchEdits([]);
    setStatus("Everything cleared");
  };

  const save = () => {
    const saved = saveProject({
      id: projectId ?? undefined,
      name: projectName,
      scene: scene.state,
      strokes: drawing.state,
      sketchEdits,
    });
    setProjectId(saved.id);
    setStatus(`Saved “${saved.name}” on this device`);
  };

  const exportScene = (format: "obj" | "stl") => {
    if (objects.length === 0) {
      setStatus("Add a shape before exporting.");
      return;
    }
    const safe = projectName.trim().replace(/\s+/g, "-").toLowerCase() || "meshpad";
    if (format === "obj") downloadText(`${safe}.obj`, toOBJ(objects));
    else downloadText(`${safe}.stl`, toSTL(objects));
    setStatus(`Downloaded ${safe}.${format}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:flex sm:flex-wrap sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-xl text-primary-foreground">
              ◆
            </span>
            <div className="min-w-0">
              <h1 className="font-display truncate text-xl">MeshPad Lite</h1>
              <p className="truncate text-xs text-muted-foreground">
                Draw → Extrude → Edit → Export
              </p>
            </div>
          </div>
          <div className="col-span-2 flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="project-name">
              Project name
            </label>
            <input
              id="project-name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm sm:w-48 sm:flex-none"
            />
            <HeaderButton onClick={newProject} icon={<FilePlus2 className="h-4 w-4" />}>
              New
            </HeaderButton>
            <HeaderButton onClick={clearAll} icon={<Trash2 className="h-4 w-4" />}>
              Clear all
            </HeaderButton>
            <HeaderButton onClick={save} icon={<Save className="h-4 w-4" />} primary>
              Save
            </HeaderButton>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-4">
        {showHelp && <Onboarding onDismiss={() => setShowHelp(false)} />}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <div className="space-y-4">
            <SketchEditPanel
              onAdd={handleSketchAdd}
              onDelete={handleSketchDelete}
              onClear={clearAll}
              edits={sketchEdits}
            />

            <section className="rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-5">
              <h2 className="font-display text-xl">2. Add ready-made shapes</h2>
              <p className="mb-3 text-sm text-muted-foreground">
                Tap one to drop it into your scene.
              </p>
              <ShapeLibrary onAdd={(kind) => addShape(kind)} />
            </section>
          </div>

          <div className="space-y-4">
            <section className="rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <h2 className="font-display truncate text-xl">3. Your 3D scene</h2>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <HeaderButton
                    onClick={scene.undo}
                    icon={<Undo2 className="h-4 w-4" />}
                    disabled={!scene.canUndo}
                  >
                    Undo
                  </HeaderButton>
                  <HeaderButton
                    onClick={scene.redo}
                    icon={<Redo2 className="h-4 w-4" />}
                    disabled={!scene.canRedo}
                  >
                    Redo
                  </HeaderButton>
                  <HeaderButton
                    onClick={() => setWireframe((w) => !w)}
                    icon={<Grid3x3 className="h-4 w-4" />}
                  >
                    {wireframe ? "Solid" : "Wireframe"}
                  </HeaderButton>
                  <HeaderButton
                    onClick={() => setResetToken((t) => t + 1)}
                    icon={<RotateCcw className="h-4 w-4" />}
                  >
                    Reset view
                  </HeaderButton>
                </div>
              </div>

              <div className="relative mt-3 h-[420px] overflow-hidden rounded-2xl border border-border sm:h-[520px]">
                <Viewer3D
                  objects={objects}
                  selectedId={scene.state.selectedId}
                  wireframe={wireframe}
                  resetToken={resetToken}
                  onSelect={(id) =>
                    setScene({ ...scene.state, selectedId: id }, { history: false })
                  }
                  onMove={(id, position) =>
                    setScene(
                      {
                        ...scene.state,
                        objects: objects.map((object) =>
                          object.id === id ? { ...object, position } : object,
                        ),
                      },
                      { history: false },
                    )
                  }
                />
                {objects.length === 0 && (
                  <div className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center">
                    <div className="rounded-2xl bg-card/90 px-5 py-4">
                      <p className="font-display text-lg">Your scene is empty</p>
                      <p className="text-sm text-muted-foreground">
                        Sketch an ADD operation to build geometry, or add a ready-made shape.
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Drag a mesh to move it · drag empty space to orbit · right-drag to pan · scroll to
                zoom · arrow keys move the selected shape · Delete removes it
              </p>
            </section>

            <section className="rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-5">
              <h2 className="font-display text-xl">4. Edit &amp; export</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {objects.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() =>
                      setScene({ ...scene.state, selectedId: o.id }, { history: false })
                    }
                    className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${
                      o.id === scene.state.selectedId
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <span
                      aria-hidden
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: o.color }}
                    />
                    {o.name}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <ObjectInspector
                  object={selected}
                  onChange={(patch) => patchSelected(patch)}
                  onCommit={commit}
                  onDuplicate={duplicateSelected}
                  onDelete={deleteSelected}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => exportScene("obj")}
                  className="inline-flex items-center gap-2 rounded-2xl bg-secondary px-4 py-3 font-semibold text-secondary-foreground hover:brightness-105"
                >
                  <Download className="h-4 w-4" /> Download OBJ
                </button>
                <button
                  type="button"
                  onClick={() => exportScene("stl")}
                  className="inline-flex items-center gap-2 rounded-2xl bg-secondary px-4 py-3 font-semibold text-secondary-foreground hover:brightness-105"
                >
                  <Download className="h-4 w-4" /> Download STL
                </button>
              </div>
            </section>
          </div>
        </div>

        <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
          {status}
        </p>
      </main>
    </div>
  );
}

function HeaderButton({
  children,
  onClick,
  icon,
  primary,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  icon?: React.ReactNode;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-40 ${
        primary
          ? "border-primary bg-primary text-primary-foreground hover:brightness-105"
          : "border-border bg-background hover:bg-muted"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
