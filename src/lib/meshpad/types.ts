export type Point = { x: number; y: number };

/** A single freehand line drawn on the 2D canvas. */
export type Stroke = {
  id: string;
  points: Point[];
};

export type ShapeKind = "cube" | "sphere" | "cylinder" | "cone" | "extrude";

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
  /** Canvas size the outline was captured at. */
  outlineSize?: { width: number; height: number };
  depth?: number;
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
};

export const emptyScene = (): SceneState => ({ objects: [], selectedId: null });

export const uid = () => Math.random().toString(36).slice(2, 10);
