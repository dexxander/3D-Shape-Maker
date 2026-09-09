import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { SceneObject } from "@/lib/meshpad/types";
import { buildGeometry } from "@/lib/meshpad/geometry";

type Props = {
  objects: SceneObject[];
  selectedId: string | null;
  wireframe: boolean;
  resetToken: number;
  onSelect: (id: string | null) => void;
  onMove: (id: string, position: [number, number, number]) => void;
};

export function Viewer3D({ objects, selectedId, wireframe, resetToken, onSelect, onMove }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    group: THREE.Group;
  } | null>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const moveRef = useRef(onMove);
  moveRef.current = onMove;
  const objectsRef = useRef(objects);
  objectsRef.current = objects;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#eef3f6");

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    camera.position.set(4.5, 3.6, 5.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    renderer.domElement.setAttribute("aria-label", "3D scene viewer");

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0.8, 0);

    scene.add(new THREE.HemisphereLight("#ffffff", "#c8d3da", 1.1));
    const key = new THREE.DirectionalLight("#ffffff", 1.9);
    key.position.set(6, 9, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const fill = new THREE.DirectionalLight("#ffd9b3", 0.5);
    fill.position.set(-6, 3, -4);
    scene.add(fill);

    const grid = new THREE.GridHelper(20, 20, "#9bb0bd", "#c9d6de");
    scene.add(grid);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.ShadowMaterial({ opacity: 0.16 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const group = new THREE.Group();
    scene.add(group);

    stateRef.current = { scene, camera, renderer, controls, group };

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downAt = { x: 0, y: 0 };
    let draggingId: string | null = null;
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.8);
    const onDown = (e: PointerEvent) => {
      downAt = { x: e.clientX, y: e.clientY };
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster
        .intersectObjects(group.children, false)
        .find((entry) => typeof entry.object.userData["id"] === "string");
      const id = hit?.object.userData["id"] as string | undefined;
      if (!id) return;
      selectRef.current(id);
      draggingId = id;
      controls.enabled = false;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!draggingId) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const point = raycaster.ray.intersectPlane(dragPlane, new THREE.Vector3());
      const current = objectsRef.current.find((object) => object.id === draggingId);
      if (point && current) moveRef.current(draggingId, [point.x, current.position[1], point.z]);
    };
    const onDragEnd = (e: PointerEvent) => {
      if (draggingId) renderer.domElement.releasePointerCapture(e.pointerId);
      draggingId = null;
      controls.enabled = true;
    };
    const onUp = (e: PointerEvent) => {
      if (draggingId) {
        onDragEnd(e);
        return;
      }
      if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(group.children, false)[0];
      selectRef.current(hit ? ((hit.object.userData["id"] as string) ?? null) : null);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointercancel", onDragEnd);

    let raf = 0;
    const loop = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointercancel", onDragEnd);
      controls.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
      stateRef.current = null;
    };
  }, []);

  // Rebuild meshes whenever the scene data changes.
  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;
    for (const child of [...s.group.children]) {
      s.group.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }
    objects.forEach((o) => {
      const mesh = new THREE.Mesh(
        buildGeometry(o),
        new THREE.MeshStandardMaterial({
          color: o.color,
          roughness: 0.45,
          metalness: 0.05,
          wireframe,
          emissive: new THREE.Color(o.id === selectedId ? "#2b6cff" : "#000000"),
          emissiveIntensity: o.id === selectedId ? 0.25 : 0,
        }),
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData["id"] = o.id;
      mesh.position.set(...o.position);
      mesh.rotation.set(...o.rotation);
      mesh.scale.set(...o.scale);
      s.group.add(mesh);

      if (o.id === selectedId) {
        const box = new THREE.BoxHelper(mesh, new THREE.Color("#2b6cff"));
        box.userData["id"] = o.id;
        s.group.add(box as unknown as THREE.Object3D);
      }
    });
  }, [objects, selectedId, wireframe]);

  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;
    s.camera.position.set(4.5, 3.6, 5.5);
    s.controls.target.set(0, 0.8, 0);
    s.controls.update();
  }, [resetToken]);

  return <div ref={hostRef} className="h-full w-full" />;
}
