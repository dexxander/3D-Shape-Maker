import * as THREE from "three";
import type { Point, SceneObject, ShapeKind } from "./types";
import { uid } from "./types";

export const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function isClosedOutline(points: Point[], canvasSize: number): boolean {
  if (points.length < 12) return false;
  return dist(points[0]!, points[points.length - 1]!) <= canvasSize * 0.14;
}

export function simplify(points: Point[], maxPoints = 160): Point[] {
  if (points.length <= maxPoints) return points;
  const step = points.length / maxPoints;
  const out: Point[] = [];
  for (let i = 0; i < maxPoints; i++) out.push(points[Math.floor(i * step)]!);
  return out;
}

function normalizedOutline(points: Point[]) {
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
  const scale = 2 / Math.max(maxX - minX, maxY - minY, 1);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return pts.map((p) => new THREE.Vector2((p.x - cx) * scale, -(p.y - cy) * scale));
}

export function outlineToShape(points: Point[], size: { width: number; height: number }) {
  const pts = normalizedOutline(points);
  const shape = new THREE.Shape();
  pts.forEach((p, i) => (i === 0 ? shape.moveTo(p.x, p.y) : shape.lineTo(p.x, p.y)));
  shape.closePath();
  void size;
  return shape;
}

/** Build a rotationally symmetric mesh from one closed radial profile. */
export function buildLatheGeometry(points: Point[]): THREE.BufferGeometry {
  const profile = normalizedOutline(points).map(
    (point) => new THREE.Vector2(Math.abs(point.x), point.y),
  );
  const geometry = new THREE.LatheGeometry(profile, 64);
  geometry.computeVertexNormals();
  return geometry;
}

export function buildSketchGeometry(points: Point[], thickness = 0.16): THREE.BufferGeometry {
  const path = simplify(points, 80).map(
    (point) => new THREE.Vector3((point.x / 600 - 0.5) * 4, 1.5 - (point.y / 360) * 3, 0),
  );
  if (path.length < 2) return new THREE.BoxGeometry(0.2, 0.2, 0.2);
  const curve = new THREE.CatmullRomCurve3(path);
  const geometry = new THREE.TubeGeometry(
    curve,
    Math.max(8, path.length * 2),
    thickness,
    12,
    false,
  );
  geometry.computeVertexNormals();
  return geometry;
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
    case "sketch":
      return buildSketchGeometry(object.sketchPath ?? [], object.thickness ?? 0.16);
    case "extrude": {
      if (!object.outline || object.outline.length < 3) return new THREE.BoxGeometry(1, 1, 1);
      if (object.revolve) {
        const geo = buildLatheGeometry(object.outline);
        geo.center();
        return geo;
      }
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
    extrude: "Revolved shape",
  };
  return {
    id: uid(),
    name: `${names[kind]} ${index + 1}`,
    kind,
    position: [0, 0.8, 0] as [number, number, number],
    rotation: [0, 0, 0] as [number, number, number],
    scale: [1, 1, 1] as [number, number, number],
    color: PALETTE[index % PALETTE.length]!,
    depth: 0.4,
    ...extra,
  } satisfies SceneObject;
}
