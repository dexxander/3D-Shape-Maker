import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  Eye,
  EyeOff,
  FilePlus2,
  Grid3x3,
  HeartHandshake,
  MessageCircleHeart,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Undo2,
  Redo2,
  Pencil,
} from "lucide-react";
import { Viewer3D } from "@/components/meshpad/Viewer3D";
import { MultiViewPanel, type ShapeAnalysis } from "@/components/meshpad/multiviewpanel";
import { ShapeLibrary } from "@/components/meshpad/ShapeLibrary";
import { ObjectInspector } from "@/components/meshpad/ObjectInspector";
import { Onboarding } from "@/components/meshpad/Onboarding";
import { useHistory } from "@/lib/meshpad/useHistory";
import { makeObject } from "@/lib/meshpad/geometry";
import { downloadText, toOBJ, toSTL } from "@/lib/meshpad/exporters";
import { lastProjectId, loadProject, saveProject } from "@/lib/meshpad/storage";
import type {
  CutOperation,
  Point,
  SceneObject,
  SceneState,
  ShapeKind,
  SketchEdit,
  Stroke,
  Vec3,
} from "@/lib/meshpad/types";
import { emptyScene, uid } from "@/lib/meshpad/types";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Imagine & Create — Family 3D Workshop" },
      {
        name: "description",
        content:
          "A family creativity experience where children imagine, create, print, and share what their ideas mean.",
      },
      { property: "og:title", content: "Imagine & Create — Family 3D Workshop" },
      {
        property: "og:description",
        content: "From what I imagine, to what I create, to what we understand about each other.",
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
  cube.name = "Building block";
  cube.position = [-1.8, 0.6, 1.4];
  const sphere = makeObject("sphere", 1);
  sphere.name = "Play ball";
  sphere.position = [1.8, 0.7, 1.4];
  const cone = makeObject("cone", 3);
  cone.name = "Party hat";
  cone.position = [0, 0.75, -2.1];
  return { objects: [cube, sphere, cone], selectedId: cube.id };
}

function MeshPad() {
  const scene = useHistory<SceneState>(emptyScene());
  const drawing = useHistory<Stroke[]>([]);
  const [sketchEdits, setSketchEdits] = useState<SketchEdit[]>([]);
  const [wireframe, setWireframe] = useState(false);
  const [showEnvironment, setShowEnvironment] = useState(true);
  const [draw3D, setDraw3D] = useState(false);
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

  const handleMultiViewBuild = (outline: Point[], analysis: ShapeAnalysis) => {
    const allowedKinds = new Set(["cube", "sphere", "cylinder", "cone", "roof", "extrude"]);
    const triple = (value: unknown, fallback: [number, number, number], mode: "position" | "scale" | "rotation") => {
      if (!Array.isArray(value) || value.length !== 3 || !value.every((n) => typeof n === "number" && Number.isFinite(n))) {
        return fallback;
      }
      return value.map((raw) => {
        const n = raw as number;
        if (mode === "rotation") {
          const radians = Math.abs(n) > Math.PI * 2 ? (n * Math.PI) / 180 : n;
          return Math.max(-Math.PI * 2, Math.min(Math.PI * 2, radians));
        }
        const world = Math.abs(n) > 8 ? n / 200 : n;
        const limit = mode === "scale" ? 4 : 6;
        return Math.max(mode === "scale" ? 0.1 : -limit, Math.min(limit, world));
      }) as [number, number, number];
    };
    const rawPlans = analysis.parts?.length
      ? analysis.parts.slice(0, 8).map((part, index) => ({
          name: typeof part.name === "string" && part.name.trim() ? part.name : `${analysis.objectType} part ${index + 1}`,
          kind: allowedKinds.has(part.kind) ? part.kind : "cube" as const,
          scale: triple(part.scale, [1, 1, 1], "scale"),
          position: triple(part.position, [0, 0.8, 0], "position"),
          rotation: triple(part.rotation, [0, 0, 0], "rotation"),
          color: typeof part.color === "string" && /^#[0-9a-f]{6}$/i.test(part.color) ? part.color : "#6a8cff",
        }))
      : [{
          name: "Main silhouette",
          kind: "extrude" as const,
          scale: [1, 1, 1] as [number, number, number],
          position: [0, 0.8, 0] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
          color: "#6a8cff",
        }];
    const objectLabel = analysis.objectType.toLowerCase();
    const looksLikeHouse = (() => {
      if (outline.length < 12) return false;
      const xs = outline.map((point) => point.x);
      const ys = outline.map((point) => point.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const width = Math.max(1, maxX - minX);
      const height = Math.max(1, maxY - minY);
      const top = outline.filter((point) => point.y <= minY + height * 0.16);
      const lower = outline.filter((point) => point.y >= minY + height * 0.42);
      const topSpan = top.length ? (Math.max(...top.map((point) => point.x)) - Math.min(...top.map((point) => point.x))) / width : 1;
      const lowerSpan = lower.length ? (Math.max(...lower.map((point) => point.x)) - Math.min(...lower.map((point) => point.x))) / width : 0;
      return height / width > 0.65 && topSpan < 0.55 && lowerSpan > 0.65;
    })();
    const isHouse = /house|home|building|cottage/.test(objectLabel) || looksLikeHouse;
    // The user's silhouette is always the main object. AI-generated primitives
    // are optional details only; they must never replace the actual drawing.
    const plans = isHouse ? [] : rawPlans.filter((part) => part.kind !== "extrude");
    const mainObject = makeObject("extrude", objects.length, {
      name: `${analysis.objectType || "Drawn object"} silhouette`,
      outline,
      outlineSize: { width: 600, height: 600 },
      depth: Math.max(0.12, Math.min(4, (Number.isFinite(analysis.depth) ? analysis.depth : 80) / 160)),
      revolve: false,
      position: [0, 0.8, 0],
      scale: [1, 1, 1],
      color: isHouse ? "#c96b52" : "#6a8cff",
    });
    const detailObjects = plans.map((part, index) => {
      const isExtrude = part.kind === "extrude";
      return makeObject(part.kind, objects.length + index, {
        name: part.name || `${analysis.objectType} part ${index + 1}`,
        color: part.color,
        position: part.position,
        rotation: part.rotation,
        scale: part.scale,
        ...(isExtrude
          ? {
              outline,
              outlineSize: { width: 600, height: 600 },
              depth: Math.max(0.12, Math.min(4, (Number.isFinite(analysis.depth) ? analysis.depth : 80) / 160)),
              revolve: analysis.form === "revolve",
            }
          : {}),
      });
    });
    const newObjects = [mainObject, ...detailObjects];
    const next = [...objects, ...newObjects];
    const selectedId = newObjects[newObjects.length - 1]!.id;
    setScene({ objects: next, selectedId });
    setResetToken((token) => token + 1);
    persistSnapshot({ objects: next, selectedId }, sketchEdits);
    setStatus(`${analysis.source === "gemini" ? "Gemini generated" : "Local fallback generated"} a 3D ${analysis.objectType} — ${analysis.width.toFixed(0)} × ${analysis.height.toFixed(0)} × ${analysis.depth.toFixed(0)} drawing units.`);
  };

  const handleExtrude3D = useCallback(
    (
      outline: Point[],
      transform?: {
        position?: [number, number, number];
        rotation?: [number, number, number];
        scale?: [number, number, number];
        name?: string;
      },
      holes?: Point[][],
    ) => {
      const object = makeObject("extrude", objects.length, {
        name: transform?.name ?? `3D Extrusion ${objects.length + 1}`,
        outline,
        ...(holes && holes.length > 0 ? { holes } : {}),
        outlineSize: { width: 600, height: 600 },
        depth: 0.5,
        revolve: false,
        position: transform?.position ?? [0, 1.2, 0],
        rotation: transform?.rotation ?? [0, 0, 0],
        scale: transform?.scale ?? [1, 1, 1],
      });
      const next = [...objects, object];
      setScene({ objects: next, selectedId: object.id });
      persistSnapshot({ objects: next, selectedId: object.id }, sketchEdits);
      setStatus(`Added ${object.name} to the scene`);
    },
    [objects, setScene, sketchEdits],
  );

  const handleCut3D = useCallback(
    (targetId: string, cut: CutOperation) => {
      const target = objects.find((o) => o.id === targetId);
      if (!target) return;
      const next = objects.map((o) =>
        o.id === targetId
          ? {
              ...o,
              cuts: [...(o.cuts ?? []), cut],
            }
          : o,
      );
      setScene({ objects: next, selectedId: targetId });
      persistSnapshot({ objects: next, selectedId: targetId }, sketchEdits);
      setStatus(`Carved cut into ${target.name}`);
    },
    [objects, setScene, sketchEdits],
  );

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
              <h1 className="font-display truncate text-xl">Imagine &amp; Create</h1>
              <p className="truncate text-xs text-muted-foreground">
                Imagine → Build → Play → Share
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

        <section className="overflow-hidden rounded-[2rem] border border-border bg-gradient-to-br from-[#fff1dc] via-card to-[#e3f5ef] p-5 shadow-soft sm:p-7">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-card/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-primary">
                <Sparkles className="h-4 w-4" /> Family 3D workshop
              </div>
              <h2 className="max-w-2xl font-display text-3xl leading-tight sm:text-5xl">
                Build a toy-room playground for big little ideas.
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Turn simple shapes into playful toys, then move them around a bright 3D playroom and
                make up a story together.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm font-semibold">
              <div className="rounded-2xl bg-card/80 p-3">
                <Sparkles className="mx-auto mb-2 h-6 w-6 text-primary" />
                Imagine
              </div>
              <div className="rounded-2xl bg-card/80 p-3">
                <HeartHandshake className="mx-auto mb-2 h-6 w-6 text-success" />
                Create
              </div>
              <div className="rounded-2xl bg-card/80 p-3">
                <MessageCircleHeart className="mx-auto mb-2 h-6 w-6 text-secondary" />
                Share
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <div className="space-y-4">
            <MultiViewPanel onBuild={handleMultiViewBuild} />

            <section className="rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-5">
              <h2 className="font-display text-xl">2. Add building blocks</h2>
              <p className="mb-3 text-sm text-muted-foreground">
                Add a simple shape when your family wants a starting point.
              </p>
              <ShapeLibrary onAdd={(kind) => addShape(kind)} />
            </section>
          </div>

          <div className="space-y-4">
            <section className="rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <h2 className="font-display truncate text-xl">3. Play in your toy room</h2>
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
                    onClick={() => setShowEnvironment((visible) => !visible)}
                    icon={showEnvironment ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  >
                    {showEnvironment ? "Hide playground" : "Show playground"}
                  </HeaderButton>
                  <HeaderButton
                    onClick={() => setResetToken((t) => t + 1)}
                    icon={<RotateCcw className="h-4 w-4" />}
                  >
                    Reset view
                  </HeaderButton>
                  <HeaderButton
                    onClick={() => setDraw3D((d) => !d)}
                    icon={<Pencil className="h-4 w-4" />}
                    primary={draw3D}
                  >
                    {draw3D ? "Exit 3D drawing" : "Draw in 3D"}
                  </HeaderButton>
                </div>
              </div>

              <div className="relative mt-3 h-[420px] overflow-hidden rounded-2xl border border-border sm:h-[520px]">
                <Viewer3D
                  objects={objects}
                  selectedId={scene.state.selectedId}
                  wireframe={wireframe}
                  showEnvironment={showEnvironment}
                  resetToken={resetToken}
                  draw3D={draw3D}
                  onToggleDraw3D={setDraw3D}
                  onExtrude3D={handleExtrude3D}
                  onCut3D={handleCut3D}
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
                  onDepthChange={(id, depth) =>
                    setScene(
                      {
                        ...scene.state,
                        objects: objects.map((object) =>
                          object.id === id ? { ...object, depth } : object,
                        ),
                      },
                      { history: false },
                    )
                  }
                  onCommitDepth={commit}
                />
                {objects.length === 0 && (
                  <div className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center">
                    <div className="rounded-2xl bg-card/90 px-5 py-4">
                      <p className="font-display text-lg">Your scene is empty</p>
                      <p className="text-sm text-muted-foreground">
                        Draw a front silhouette to build a 3D object, or add a ready-made shape.
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
              <h2 className="font-display text-xl">4. Prepare it for the real world</h2>
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
                  <Download className="h-4 w-4" /> Export OBJ
                </button>
                <button
                  type="button"
                  onClick={() => exportScene("stl")}
                  className="inline-flex items-center gap-2 rounded-2xl bg-secondary px-4 py-3 font-semibold text-secondary-foreground hover:brightness-105"
                >
                  <Download className="h-4 w-4" /> Export STL for printing
                </button>
              </div>
            </section>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/15 text-primary">
                <Download className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                  Next step
                </p>
                <h3 className="font-display text-xl">Make it real</h3>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Export your family’s creation for 3D printing, then let the child hold the idea they
              imagined.
            </p>
          </div>
          <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-secondary/15 text-secondary">
                <MessageCircleHeart className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-secondary">
                  Family reflection
                </p>
                <h3 className="font-display text-xl">What does it mean?</h3>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Ask: “What does your object represent?” “What should it help us remember?” “How can we
              build on this idea together?”
            </p>
          </div>
        </section>

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
