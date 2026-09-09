import * as THREE from "three";
import type { Point, SceneObject, ShapeKind } from "./types";
import { uid } from "./types";

/** Distance between two points. */
export const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** A drawn outline counts as closed when its ends nearly meet. */
export function isClosedOutline(points: Point[], canvasSize: number): boolean {
  if (points.length < 12) return false;
  return dist(points[0]!, points[points.length - 1]!) <= canvasSize * 0.14;
}

/** Reduce a freehand path to a manageable number of points. */
export function simplify(points: Point[], maxPoints = 160): Point[] {
  if (points.length <= maxPoints) return points;
  const step = points.length / maxPoints;
  const out: Point[] = [];
  for (let i = 0; i < maxPoints; i++) out.push(points[Math.floor(i * step)]!);
  return out;
}

/** Convert a pixel-space outline into a centred, normalised THREE.Shape. */
export function outlineToShape(points: Point[], size: { width: number; height: number }) {
  const pts = simplify(points);
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const w = Math.max(maxX - minX, 1);
  const h = Math.max(maxY - minY, 1);
  const scale = 2 / Math.max(w, h);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  const shape = new THREE.Shape();
  pts.forEach((p, i) => {
    const x = (p.x - cx) * scale;
    const y = -(p.y - cy) * scale; // canvas Y grows downward
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  void size;
  return shape;
}

export function buildGeometry(object: SceneObject): THREE.BufferGeometry {
  switch (object.kind) {
    case "cube":
      return new THREE.BoxGeometry(1, 1, 1);
    case "sphere":
      return new THREE.SphereGeometry(0.65, 40, 28);
    case "cylinder":
      return new THREE.CylinderGeometry(0.5, 0.5, 1.2, 40);
    case "cone":
      return new THREE.ConeGeometry(0.6, 1.3, 40);
    case "extrude": {
      if (!object.outline || object.outline.length < 3) return new THREE.BoxGeometry(1, 1, 1);
      const shape = outlineToShape(
        object.outline,
        object.outlineSize ?? { width: 600, height: 600 },
      );
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: object.depth ?? 0.4,
        bevelEnabled: true,
        bevelThickness: 0.04,
        bevelSize: 0.04,
        bevelSegments: 2,
        curveSegments: 6,
      });
      geo.center();
      return geo;
    }
  }
}

const PALETTE = ["#ff8a5b", "#48b8a0", "#6a8cff", "#ffc857", "#e05c6e", "#8f7bd8"];

export function makeObject(kind: ShapeKind, index: number, extra: Partial<SceneObject> = {}) {
  const names: Record<ShapeKind, string> = {
    cube: "Cube",
    sphere: "Sphere",
    cylinder: "Cylinder",
    cone: "Cone",
    extrude: "Drawing",
  };
  const object: SceneObject = {
    id: uid(),
    name: `${names[kind]} ${index + 1}`,
    kind,
    position: [0, 0.8, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: PALETTE[index % PALETTE.length]!,
    depth: 0.4,
    ...extra,
  };
  return object;
}
