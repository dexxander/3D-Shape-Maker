export type Point = { x: number; y: number };

/** A single freehand line drawn on the 2D canvas. */
export type Stroke = {
  id: string;
  points: Point[];
};

export type SketchEdit = {
  id: string;
  operation: "add" | "delete";
  points: Point[];
  createdAt: number;
};

export type ShapeKind = "cube" | "sphere" | "cylinder" | "cone" | "extrude" | "sketch";

export type Vec3 = [number, number, number];

export type SceneObject = {
  id: string;
  name: string;
  kind: ShapeKind;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  color: string;
  /** Only for kind === "extrude": outline in canvas pixel space. */
  outline?: Point[];
  /** Treat the outline as a radial profile and revolve it around the Y axis. */
  revolve?: boolean;
  /** Canvas size the outline was captured at. */
  outlineSize?: { width: number; height: number };
  depth?: number;
  /** One continuous ADD sketch represented as a 3D tube. */
  sketchPath?: Point[];
  sketchCenter?: Point;
  thickness?: number;
};

export type SceneState = {
  objects: SceneObject[];
  selectedId: string | null;
};

export type Project = {
  id: string;
  name: string;
  updatedAt: number;
  scene: SceneState;
  strokes: Stroke[];
  sketchEdits?: SketchEdit[];
};

export const emptyScene = (): SceneState => ({ objects: [], selectedId: null });

export const uid = () => Math.random().toString(36).slice(2, 10);
