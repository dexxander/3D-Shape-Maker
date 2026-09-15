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

/**
 * ---------------------------------------------------------------------
 * Multi-view (front + side) reconstruction
 * ---------------------------------------------------------------------
 * A single 2D outline can only ever constrain two of the three spatial
 * dimensions (whatever axes the drawing plane spans). To recover width,
 * height AND depth independently — without any AI/ML model guessing the
 * missing dimension — we ask for TWO outlines sharing the same vertical
 * (height) axis:
 *
 *   - frontOutline: drawn on a "front view" canvas. Its horizontal span
 *     at a given height becomes the object's WIDTH at that height.
 *   - sideOutline: drawn on a "side view" canvas of the SAME pixel
 *     height. Its horizontal span at a given height becomes the
 *     object's DEPTH at that height.
 *
 * We slice both outlines into horizontal bands, read off a width and a
 * depth radius per band, and loft an elliptical cross-section through
 * all the bands. This is plain, deterministic geometry — the exact
 * technique used in old-style orthographic-projection modeling — with
 * no server calls and no generative guessing involved.
 */

type HeightProfile = { center: number; radius: number };

/**
 * Buckets an outline's points into `bins` horizontal bands between yMin
 * and yMax, and returns each band's horizontal center and half-width
 * (radius). Bands with no points get their radius/center interpolated
 * from their nearest filled neighbours so the profile stays continuous.
 */
function extractHeightProfile(
  points: Point[],
  bins: number,
  yMin: number,
  yMax: number,
): HeightProfile[] {
  const buckets: { min: number; max: number }[] = Array.from({ length: bins }, () => ({
    min: Infinity,
    max: -Infinity,
  }));
  const span = yMax - yMin || 1;

  for (const p of points) {
    const t = (p.y - yMin) / span;
    const bin = Math.min(bins - 1, Math.max(0, Math.floor(t * bins)));
    buckets[bin]!.min = Math.min(buckets[bin]!.min, p.x);
    buckets[bin]!.max = Math.max(buckets[bin]!.max, p.x);
  }

  const filled = buckets.map((b) => b.min !== Infinity);

  for (let i = 0; i < bins; i++) {
    if (filled[i]) continue;

    let lo = i;
    while (lo >= 0 && !filled[lo]) lo--;
    let hi = i;
    while (hi < bins && !filled[hi]) hi++;

    if (lo < 0 && hi >= bins) {
      // No data anywhere on this outline — fall back to a thin sliver
      // so the mesh doesn't collapse to a zero-width point.
      buckets[i] = { min: -0.01, max: 0.01 };
    } else if (lo < 0) {
      buckets[i] = { ...buckets[hi]! };
    } else if (hi >= bins) {
      buckets[i] = { ...buckets[lo]! };
    } else {
      const t = (i - lo) / (hi - lo);
      buckets[i] = {
        min: buckets[lo]!.min + (buckets[hi]!.min - buckets[lo]!.min) * t,
        max: buckets[lo]!.max + (buckets[hi]!.max - buckets[lo]!.max) * t,
      };
    }
  }

  return buckets.map((b) => ({
    center: (b.min + b.max) / 2,
    radius: Math.max((b.max - b.min) / 2, 0.001),
  }));
}

/**
 * Combines a front outline (width per height) and a side outline (depth
 * per height) into one solid mesh by lofting an elliptical
 * cross-section between the two profiles at each height slice, then
 * capping the top and bottom. Pure geometry — no CSG, no ML, no network
 * calls.
 *
 * @param frontOutline closed outline drawn on the "Front" canvas
 * @param sideOutline closed outline drawn on the "Side" canvas (same
 *   canvas pixel height as the front one)
 * @param segments how many points around each elliptical ring (higher =
 *   smoother but heavier mesh)
 * @param bins how many horizontal height slices to loft through (higher
 *   = more faithful to the drawn outline but heavier mesh)
 */
export function buildMultiViewGeometry(
  frontOutline: Point[],
  sideOutline: Point[],
  segments = 28,
  bins = 40,
): THREE.BufferGeometry {
  if (frontOutline.length < 3 || sideOutline.length < 3) {
    return new THREE.BoxGeometry(1, 1, 1);
  }

  // Both outlines are expected to share the same canvas height, but we
  // derive the shared Y range from whichever data we actually have so a
  // mismatch doesn't produce a broken mesh.
  const allY = [...frontOutline, ...sideOutline].map((p) => p.y);
  const yMin = Math.min(...allY);
  const yMax = Math.max(...allY);
  const maxExtent = Math.max(yMax - yMin, 1);
  const scale = 2 / maxExtent;

  const frontProfile = extractHeightProfile(frontOutline, bins, yMin, yMax);
  const sideProfile = extractHeightProfile(sideOutline, bins, yMin, yMax);

  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < bins; i++) {
    const t = i / (bins - 1);
    const yCanvas = yMin + t * (yMax - yMin);
    // Flip + center: canvas Y grows downward, 3D Y grows upward.
    const y3 = -(yCanvas - (yMin + yMax) / 2) * scale;

    const rx = frontProfile[i]!.radius * scale; // width radius at this height
    const cx = frontProfile[i]!.center * scale;
    const rz = sideProfile[i]!.radius * scale; // depth radius at this height
    const cz = sideProfile[i]!.center * scale;

    for (let s = 0; s < segments; s++) {
      const theta = (s / segments) * Math.PI * 2;
      positions.push(cx + rx * Math.cos(theta), y3, cz + rz * Math.sin(theta));
    }
  }

  // Side walls: connect each ring to the next.
  for (let i = 0; i < bins - 1; i++) {
    for (let s = 0; s < segments; s++) {
      const s2 = (s + 1) % segments;
      const a = i * segments + s;
      const b = i * segments + s2;
      const c = (i + 1) * segments + s;
      const d = (i + 1) * segments + s2;
      indices.push(a, c, b, b, c, d);
    }
  }

  // Cap the bottom (ring 0) and top (last ring) with a fan of triangles
  // to a centroid vertex, so the mesh is closed (watertight) — this
  // matters for STL/3D-printing export.
  const capRing = (ringIndex: number, flip: boolean) => {
    const start = ringIndex * segments;
    const centroidIndex = positions.length / 3;
    let cx = 0,
      cy = 0,
      cz = 0;
    for (let s = 0; s < segments; s++) {
      cx += positions[(start + s) * 3]!;
      cy += positions[(start + s) * 3 + 1]!;
      cz += positions[(start + s) * 3 + 2]!;
    }
    positions.push(cx / segments, cy / segments, cz / segments);
    for (let s = 0; s < segments; s++) {
      const s2 = (s + 1) % segments;
      const a = start + s;
      const b = start + s2;
      indices.push(centroidIndex, flip ? b : a, flip ? a : b);
    }
  };
  capRing(0, true);
  capRing(bins - 1, false);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
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
    case "multiview": {
      const geo = buildMultiViewGeometry(object.frontOutline ?? [], object.sideOutline ?? []);
      geo.center();
      return geo;
    }
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
    sketch: "Sketch part",
    multiview: "Sculpted shape",
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