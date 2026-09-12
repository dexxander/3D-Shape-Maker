import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { SceneObject } from "@/lib/meshpad/types";
import { buildGeometry } from "@/lib/meshpad/geometry";

const roomMaterial = (color: string, roughness = 0.72) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });

function addRoomDecor(scene: THREE.Scene) {
  const decor = new THREE.Group();
  decor.name = "toy-room-decor";

  // Soft foam play-mat floor: alternating tiles make the room read instantly as a toy space.
  const tileColors = ["#f8c7d8", "#bde8df", "#ffe4a8", "#c8d7ff"];
  const tileGeometry = new THREE.BoxGeometry(1.85, 0.12, 1.85);
  for (let x = -9; x <= 9; x++) {
    for (let z = -9; z <= 9; z++) {
      const colorIndex = ((x + z + 8) % tileColors.length + tileColors.length) % tileColors.length;
      const tile = new THREE.Mesh(tileGeometry, roomMaterial(tileColors[colorIndex]!));
      tile.position.set(x * 1.9, -0.07, z * 1.9);
      tile.receiveShadow = true;
      decor.add(tile);
    }
  }

  // Back wall and side wall give the camera a cozy indoor playroom frame.
  const wall = new THREE.Mesh(new THREE.BoxGeometry(38, 10, 0.22), roomMaterial("#fff3df"));
  wall.position.set(0, 4.85, -18.8);
  wall.receiveShadow = true;
  decor.add(wall);
  const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.22, 10, 38), roomMaterial("#e7f6f3"));
  sideWall.position.set(-18.8, 4.85, 0);
  sideWall.receiveShadow = true;
  decor.add(sideWall);

  // A low colorful rug keeps the middle open for the shapes the child creates.
  const rug = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.08, 5.2), roomMaterial("#fffaf0"));
  rug.position.set(0.3, 0.02, 0.6);
  rug.receiveShadow = true;
  decor.add(rug);
  for (let i = -3; i <= 3; i++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.09, 5.26), roomMaterial(["#ff9fb8", "#ffc857", "#8bd3c7"][Math.abs(i) % 3]!));
    stripe.position.set(0.3 + i * 1.08, 0.08, 0.6);
    decor.add(stripe);
  }

  // Toy shelf against the back wall.
  const wood = roomMaterial("#d99566");
  const shelfParts = [
    [7.6, 1.25, -9.95, 2.7, 0.18, 0.62],
    [7.6, 2.3, -9.95, 2.7, 0.18, 0.62],
    [7.6, 0.2, -9.95, 2.95, 0.28, 0.75],
    [6.3, 1.65, -9.95, 0.18, 2.8, 0.72],
    [8.9, 1.65, -9.95, 0.18, 2.8, 0.72],
  ] as const;
  for (const [x, y, z, sx, sy, sz] of shelfParts) {
    const part = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), wood);
    part.position.set(x, y, z);
    part.castShadow = true;
    part.receiveShadow = true;
    decor.add(part);
  }
  const blockColors = ["#ff8a5b", "#6a8cff", "#ffc857", "#48b8a0"];
  for (let i = 0; i < 4; i++) {
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.48), roomMaterial(blockColors[i]!));
    block.position.set(6.75 + i * 0.52, 1.62, -9.55);
    block.rotation.y = i * 0.22;
    block.castShadow = true;
    decor.add(block);
  }

  // Teddy bear: a friendly silhouette made from soft spheres.
  const bear = new THREE.Group();
  const fur = roomMaterial("#a96d4b");
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.52, 24, 16), fur);
  belly.scale.set(0.85, 1.05, 0.65);
  belly.position.set(7.6, 0.82, -8.95);
  bear.add(belly);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.48, 24, 16), fur);
  head.position.set(7.6, 1.55, -8.95);
  bear.add(head);
  for (const [x, y] of [[7.28, 1.88], [7.92, 1.88]] as const) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 12), fur);
    ear.position.set(x, y, -8.95);
    bear.add(ear);
  }
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 12), roomMaterial("#f4c5a2"));
  muzzle.position.set(7.6, 1.43, -8.52);
  bear.add(muzzle);
  bear.traverse((child) => {
    if (child instanceof THREE.Mesh) child.castShadow = true;
  });
  decor.add(bear);

  // Oversized beach ball in the corner.
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.65, 32, 20), roomMaterial("#ff8a5b", 0.5));
  ball.position.set(-7.8, 0.68, -8.95);
  ball.castShadow = true;
  decor.add(ball);
  for (const rotation of [0.3, 2.4, 4.5]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.045, 8, 32, Math.PI * 0.58), roomMaterial("#fff8e8", 0.5));
    band.position.copy(ball.position);
    band.rotation.set(Math.PI / 2, rotation, 0);
    decor.add(band);
  }

  // Small wall pennants add a playful finish without competing with the editable meshes.
  const pennantColors = ["#ff8a5b", "#6a8cff", "#ffc857", "#48b8a0", "#e05c6e"];
  for (let i = 0; i < 5; i++) {
    const pennant = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.55, 3), roomMaterial(pennantColors[i]!));
    pennant.position.set(-2.1 + i * 1.05, 7.25, -18.62);
    pennant.rotation.set(Math.PI / 2, 0, Math.PI);
    decor.add(pennant);
  }

  // Extra room details: a window, floor cushions, and a small play tent.
  const windowFrame = roomMaterial("#8bcbd0");
  const windowGlass = roomMaterial("#bfeaf2", 0.35);
  const window = new THREE.Mesh(new THREE.BoxGeometry(3.8, 2.3, 0.12), windowGlass);
  window.position.set(-3.4, 5.65, -18.63);
  decor.add(window);
  const windowBars = [
    new THREE.BoxGeometry(3.95, 0.12, 0.16),
    new THREE.BoxGeometry(0.12, 2.55, 0.16),
    new THREE.BoxGeometry(0.1, 2.2, 0.18),
    new THREE.BoxGeometry(3.7, 0.1, 0.18),
  ];
  const windowBarPositions: [number, number][] = [
    [-3.4, 6.8],
    [-5.35, 5.65],
    [-3.4, 5.65],
    [-3.4, 5.65],
  ];
  windowBars.forEach((geometry, i) => {
    const bar = new THREE.Mesh(geometry, windowFrame);
    bar.position.set(windowBarPositions[i]![0], windowBarPositions[i]![1], -18.52);
    decor.add(bar);
  });

  const cushionColors = ["#f7a8c4", "#9bded0", "#a9bdf5"];
  for (let i = 0; i < 3; i++) {
    const cushion = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 12), roomMaterial(cushionColors[i]!));
    cushion.scale.set(1.35, 0.35, 1.05);
    cushion.position.set(-7 + i * 1.15, 0.38, -8.2);
    cushion.castShadow = true;
    decor.add(cushion);
  }

  const tent = new THREE.Group();
  const tentFabric = roomMaterial("#f8c7d8");
  const tentSide = new THREE.Mesh(new THREE.ConeGeometry(1.55, 2.55, 4), tentFabric);
  tentSide.position.set(-7.2, 1.25, -4.4);
  tentSide.rotation.y = Math.PI / 4;
  tent.add(tentSide);
  const tentDoor = new THREE.Mesh(new THREE.ConeGeometry(0.52, 1.2, 3), roomMaterial("#fff3df"));
  tentDoor.position.set(-7.2, 0.85, -5.58);
  tentDoor.rotation.set(Math.PI / 2, 0, Math.PI);
  tent.add(tentDoor);
  tent.traverse((child) => {
    if (child instanceof THREE.Mesh) child.castShadow = true;
  });
  decor.add(tent);

  // Larger play-center details: a mini slide, climbing arch, and ball pit.
  const slideColor = roomMaterial("#f39a5d");
  const slideDeck = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.2, 1.8), roomMaterial("#ffc857"));
  slideDeck.position.set(5.8, 1.65, 3.9);
  slideDeck.castShadow = true;
  decor.add(slideDeck);
  for (const x of [5.1, 6.5]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.7, 0.18), slideColor);
    leg.position.set(x, 0.82, 3.9);
    leg.castShadow = true;
    decor.add(leg);
  }
  const slide = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.16, 4.1), slideColor);
  slide.position.set(5.8, 0.8, 5.9);
  slide.rotation.x = -0.28;
  slide.castShadow = true;
  decor.add(slide);
  for (const x of [4.85, 6.75]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 1.65), roomMaterial("#e05c6e"));
    rail.position.set(x, 1.9, 3.9);
    rail.castShadow = true;
    decor.add(rail);
  }

  const arch = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.12, 12, 32, Math.PI), roomMaterial("#6a8cff"));
  arch.position.set(-2.6, 1.45, 4.8);
  arch.rotation.set(Math.PI / 2, 0, 0);
  arch.castShadow = true;
  decor.add(arch);
  for (const x of [-3.75, -1.45]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.45, 0.18), roomMaterial("#48b8a0"));
    post.position.set(x, 0.72, 4.8);
    post.castShadow = true;
    decor.add(post);
  }

  const pitBase = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.65, 2.8), roomMaterial("#8f7bd8"));
  pitBase.position.set(-5.4, 0.3, 4.4);
  pitBase.castShadow = true;
  pitBase.receiveShadow = true;
  decor.add(pitBase);
  const pitBallColors = ["#ff8a5b", "#ffc857", "#48b8a0", "#e05c6e", "#6a8cff"];
  for (let i = 0; i < 12; i++) {
    const pitBall = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), roomMaterial(pitBallColors[i % pitBallColors.length]!));
    pitBall.position.set(-6.55 + (i % 4) * 0.75, 0.72 + Math.floor(i / 4) * 0.18, 3.7 + (i % 3) * 0.55);
    pitBall.castShadow = true;
    decor.add(pitBall);
  }

  // Colorful wall circles add depth without crowding the taller room.
  const wallArtColors = ["#ff9fb8", "#ffc857", "#8bd3c7", "#a9bdf5"];
  for (let i = 0; i < 4; i++) {
    const art = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.12, 10, 24), roomMaterial(wallArtColors[i]!));
    art.position.set(-8 + i * 1.6, 5.4, -18.62);
    art.rotation.x = Math.PI / 2;
    decor.add(art);
  }

  scene.add(decor);
  return decor;
}

type Props = {
  objects: SceneObject[];
  selectedId: string | null;
  wireframe: boolean;
  showEnvironment: boolean;
  resetToken: number;
  onSelect: (id: string | null) => void;
  onMove: (id: string, position: [number, number, number]) => void;
};

export function Viewer3D({
  objects,
  selectedId,
  wireframe,
  showEnvironment,
  resetToken,
  onSelect,
  onMove,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    group: THREE.Group;
    decor: THREE.Group;
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
    scene.background = new THREE.Color("#cfeef4");

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    camera.position.set(20.5, 12.5, 22.5);

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
    controls.target.set(0, 1.5, -2.5);

    scene.add(new THREE.HemisphereLight("#fffaf2", "#8fbcc5", 1.7));
    const key = new THREE.DirectionalLight("#ffffff", 1.9);
    key.position.set(5, 9, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const fill = new THREE.DirectionalLight("#ffd9b3", 0.7);
    fill.position.set(-6, 3, -4);
    scene.add(fill);

    const decor = addRoomDecor(scene);

    const group = new THREE.Group();
    scene.add(group);

    stateRef.current = { scene, camera, renderer, controls, group, decor };

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
    s.camera.position.set(20.5, 12.5, 22.5);
    s.controls.target.set(0, 1.5, -2.5);
    s.controls.update();
  }, [resetToken]);

  useEffect(() => {
    if (stateRef.current) stateRef.current.decor.visible = showEnvironment;
  }, [showEnvironment]);

  return <div ref={hostRef} className="h-full w-full" />;
}
