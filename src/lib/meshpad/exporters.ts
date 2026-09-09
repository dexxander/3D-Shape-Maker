import * as THREE from "three";
import type { SceneObject } from "./types";
import { buildGeometry } from "./geometry";

/** Bake the scene objects into a single group of world-space meshes. */
function buildExportGroup(objects: SceneObject[]) {
  const group = new THREE.Group();
  objects.forEach((o) => {
    const mesh = new THREE.Mesh(buildGeometry(o), new THREE.MeshStandardMaterial());
    mesh.name = o.name.replace(/\s+/g, "_");
    mesh.position.set(...o.position);
    mesh.rotation.set(...o.rotation);
    mesh.scale.set(...o.scale);
    group.add(mesh);
  });
  group.updateMatrixWorld(true);
  return group;
}

function triangles(group: THREE.Group) {
  const out: { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; normal: THREE.Vector3 }[] = [];
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const geo = child.geometry.index
      ? child.geometry.toNonIndexed()
      : (child.geometry as THREE.BufferGeometry);
    const pos = geo.getAttribute("position");
    for (let i = 0; i < pos.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(child.matrixWorld);
      const b = new THREE.Vector3().fromBufferAttribute(pos, i + 1).applyMatrix4(child.matrixWorld);
      const c = new THREE.Vector3().fromBufferAttribute(pos, i + 2).applyMatrix4(child.matrixWorld);
      const normal = new THREE.Vector3()
        .subVectors(c, b)
        .cross(new THREE.Vector3().subVectors(a, b))
        .normalize();
      out.push({ a, b, c, normal });
    }
  });
  return out;
}

export function toOBJ(objects: SceneObject[]): string {
  const group = buildExportGroup(objects);
  const lines: string[] = ["# MeshPad Lite export"];
  let offset = 1;
  group.children.forEach((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const geo = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry;
    const pos = geo.getAttribute("position");
    lines.push(`o ${child.name}`);
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(child.matrixWorld);
      lines.push(`v ${v.x.toFixed(5)} ${v.y.toFixed(5)} ${v.z.toFixed(5)}`);
    }
    for (let i = 0; i < pos.count; i += 3) {
      lines.push(`f ${offset + i} ${offset + i + 1} ${offset + i + 2}`);
    }
    offset += pos.count;
  });
  return lines.join("\n");
}

export function toSTL(objects: SceneObject[]): string {
  const tris = triangles(buildExportGroup(objects));
  const lines = ["solid meshpad"];
  for (const t of tris) {
    lines.push(`facet normal ${t.normal.x.toFixed(5)} ${t.normal.y.toFixed(5)} ${t.normal.z.toFixed(5)}`);
    lines.push("  outer loop");
    for (const v of [t.a, t.b, t.c]) {
      lines.push(`    vertex ${v.x.toFixed(5)} ${v.y.toFixed(5)} ${v.z.toFixed(5)}`);
    }
    lines.push("  endloop");
    lines.push("endfacet");
  }
  lines.push("endsolid meshpad");
  return lines.join("\n");
}

export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
