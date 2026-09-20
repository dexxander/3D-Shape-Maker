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
  /** True when the stroke was drawn while its sketch plane was edge-on. */
  depthStroke?: boolean;
  /** Marker color used for an ADD stroke. */
  color?: string;
};

export type ShapeKind =
  "cube" | "sphere" | "cylinder" | "cone" | "roof" | "extrude" | "sketch" | "multiview";

export type Vec3 = [number, number, number];

export type CutOperation = {
  id: string;
  outline: Point[];
  holes?: Point[][];
  depth: number;
  localTransform: {
    position: Vec3;
    rotation: Vec3;
    scale: Vec3;
  };
};

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
  /** Optional array of inner closed outlines representing cut-out holes. */
  holes?: Point[][];
  /** Parametric CSG cuts (boolean subtractions) carved into this shape. */
  cuts?: CutOperation[];
  /** Treat the outline as a radial profile and revolve it around the Y axis. */
  revolve?: boolean;
  /** Canvas size the outline was captured at. */
  outlineSize?: { width: number; height: number };
  depth?: number;
  /** One continuous ADD sketch represented as a 3D tube. */
  sketchPath?: Point[];
  sketchCenter?: Point;
  thickness?: number;
  /**
   * Only for kind === "multiview": the front-facing outline (drawn on the
   * "Front" canvas). Its horizontal extent at each height defines the
   * object's WIDTH at that height. Shares the vertical (Y) axis with
   * sideOutline — both must be captured on canvases of the same pixel
   * height so the two views line up.
   */
  frontOutline?: Point[];
  /**
   * Only for kind === "multiview": the side-facing outline (drawn on the
   * "Side" canvas). Its horizontal extent at each height defines the
   * object's DEPTH at that height.
   */
  sideOutline?: Point[];
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
