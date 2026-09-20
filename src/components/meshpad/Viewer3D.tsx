import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { Pencil, Trash2, X } from "lucide-react";
import type { SceneObject, Point, CutOperation } from "@/lib/meshpad/types";
import { buildGeometry, snapToAngle } from "@/lib/meshpad/geometry";

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
      const colorIndex =
        (((x + z + 8) % tileColors.length) + tileColors.length) % tileColors.length;
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
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.48, 0.48),
      roomMaterial(blockColors[i]!),
    );
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
  for (const [x, y] of [
    [7.28, 1.88],
    [7.92, 1.88],
  ] as const) {
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
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.66, 0.045, 8, 32, Math.PI * 0.58),
      roomMaterial("#fff8e8", 0.5),
    );
    band.position.copy(ball.position);
    band.rotation.set(Math.PI / 2, rotation, 0);
    decor.add(band);
  }

  // Small wall pennants add a playful finish without competing with the editable meshes.
  const pennantColors = ["#ff8a5b", "#6a8cff", "#ffc857", "#48b8a0", "#e05c6e"];
  for (let i = 0; i < 5; i++) {
    const pennant = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.55, 3),
      roomMaterial(pennantColors[i]!),
    );
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
    const cushion = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 20, 12),
      roomMaterial(cushionColors[i]!),
    );
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

  const arch = new THREE.Mesh(
    new THREE.TorusGeometry(1.25, 0.12, 12, 32, Math.PI),
    roomMaterial("#6a8cff"),
  );
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
    const pitBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 16, 12),
      roomMaterial(pitBallColors[i % pitBallColors.length]!),
    );
    pitBall.position.set(
      -6.55 + (i % 4) * 0.75,
      0.72 + Math.floor(i / 4) * 0.18,
      3.7 + (i % 3) * 0.55,
    );
    pitBall.castShadow = true;
    decor.add(pitBall);
  }

  // Colorful wall circles add depth without crowding the taller room.
  const wallArtColors = ["#ff9fb8", "#ffc857", "#8bd3c7", "#a9bdf5"];
  for (let i = 0; i < 4; i++) {
    const art = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.12, 10, 24),
      roomMaterial(wallArtColors[i]!),
    );
    art.position.set(-8 + i * 1.6, 5.4, -18.62);
    art.rotation.x = Math.PI / 2;
    decor.add(art);
  }

  scene.add(decor);
  return decor;
}

function addGridPlane(scene: THREE.Scene) {
  const grid = new THREE.GridHelper(36, 36, "#8aa7b5", "#c9dce2");
  grid.name = "editing-grid";
  grid.position.y = -0.13;
  grid.material.transparent = true;
  grid.material.opacity = 0.9;
  scene.add(grid);
  return grid;
}

const PLANE_SIZE = 12;

type Draw3DState = {
  planeGroup: THREE.Group;
  planeMesh: THREE.Mesh;
  startMarkerGroup: THREE.Group;
  startMarkerSphere: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  startMarkerRing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  startMarkerPin: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  strokeLine: THREE.Line;
  hintSprite: THREE.Sprite;
  surfaceCursorGroup: THREE.Group;
  surfaceMesh: THREE.Mesh | null;
  surfaceObject: SceneObject | null;
  surfaceNormal: THREE.Vector3 | null;
  surfacePoint: THREE.Vector3 | null;
  points: { x: number; y: number }[];
  isDrawing: boolean;
  startPoint: { x: number; y: number } | null;
  isClosed: boolean;
};

function updateStrokeLine(drawState: Draw3DState) {
  const positions = new Float32Array(drawState.points.length * 3);
  for (let i = 0; i < drawState.points.length; i++) {
    positions[i * 3] = drawState.points[i]!.x;
    positions[i * 3 + 1] = drawState.points[i]!.y;
    positions[i * 3 + 2] = 0.025;
  }
  drawState.strokeLine.geometry.dispose();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  drawState.strokeLine.geometry = geo;
}

function resetDrawStroke(drawState: Draw3DState) {
  drawState.points = [];
  drawState.startPoint = null;
  drawState.isDrawing = false;
  drawState.isClosed = false;
  drawState.surfaceMesh = null;
  drawState.surfaceObject = null;
  drawState.surfaceNormal = null;
  drawState.surfacePoint = null;
  drawState.startMarkerGroup.visible = false;
  drawState.startMarkerGroup.scale.set(1, 1, 1);
  drawState.hintSprite.visible = true;
  drawState.strokeLine.geometry.dispose();
  drawState.strokeLine.geometry = new THREE.BufferGeometry();
}

type Props = {
  objects: SceneObject[];
  selectedId: string | null;
  wireframe: boolean;
  showEnvironment: boolean;
  resetToken: number;
  draw3D?: boolean;
  onToggleDraw3D?: (active: boolean) => void;
  onExtrude3D?: (
    outline: Point[],
    transform?: {
      position?: [number, number, number];
      rotation?: [number, number, number];
      scale?: [number, number, number];
      name?: string;
    },
  ) => void;
  onCut3D?: (targetId: string, cut: CutOperation) => void;
  onSelect: (id: string | null) => void;
  onMove: (id: string, position: [number, number, number]) => void;
  onDepthChange: (id: string, depth: number) => void;
  onCommitDepth: () => void;
};

export function Viewer3D({
  objects,
  selectedId,
  wireframe,
  showEnvironment,
  resetToken,
  draw3D = false,
  onToggleDraw3D,
  onExtrude3D,
  onCut3D,
  onSelect,
  onMove,
  onDepthChange,
  onCommitDepth,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    group: THREE.Group;
    decor: THREE.Group;
    grid: THREE.GridHelper;
  } | null>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const moveRef = useRef(onMove);
  moveRef.current = onMove;
  const depthChangeRef = useRef(onDepthChange);
  depthChangeRef.current = onDepthChange;
  const commitDepthRef = useRef(onCommitDepth);
  commitDepthRef.current = onCommitDepth;
  const objectsRef = useRef(objects);
  objectsRef.current = objects;

  const draw3DRef = useRef(draw3D);
  draw3DRef.current = draw3D;
  const extrude3DRef = useRef(onExtrude3D);
  extrude3DRef.current = onExtrude3D;
  const cut3DRef = useRef(onCut3D);
  cut3DRef.current = onCut3D;
  const drawStateRef = useRef<Draw3DState | null>(null);

  // Drawing action: "extend" (adds material outwards) vs "cut" (carves material inward)
  const [drawAction, setDrawAction] = useState<"extend" | "cut">("extend");
  const drawActionRef = useRef<"extend" | "cut">("extend");
  drawActionRef.current = drawAction;

  // Shift-key angle snapping state
  const shiftHeldRef = useRef(false);
  const [shiftActive, setShiftActive] = useState(false);
  const drawAnchorRef = useRef<Point | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Shift") {
        shiftHeldRef.current = true;
        setShiftActive(true);
      }
      if (e.key === "c" || e.key === "C") {
        if (draw3DRef.current) {
          setDrawAction((prev) => (prev === "extend" ? "cut" : "extend"));
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        shiftHeldRef.current = false;
        setShiftActive(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // HUD state for 3D drawing mode
  const [hudCoords, setHudCoords] = useState<{ x: number; y: number } | null>(null);
  const [hudStatus, setHudStatus] = useState<string>("Click & drag on the grid to start drawing");
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const [strokeLength, setStrokeLength] = useState<number>(0);

  // TransformControls instance — created in init useEffect, used in mesh-rebuild useEffect
  const tcRef = useRef<{
    tc: TransformControls;
    helper: THREE.Object3D;
    anchor: THREE.Object3D;
  } | null>(null);
  // Tracks which object the depth handle is targeting (shared between useEffects)
  const depthObjectIdRef = useRef<string | null>(null);

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
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.setAttribute("aria-label", "3D scene viewer");

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = true;
    controls.touches.ONE = THREE.TOUCH.ROTATE;
    controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
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
    const grid = addGridPlane(scene);

    const group = new THREE.Group();
    scene.add(group);

    stateRef.current = { scene, camera, renderer, controls, group, decor, grid };

    // ── Depth handle: TransformControls constrained to Z-axis ──────
    const tc = new TransformControls(camera, renderer.domElement);
    tc.setMode("translate");
    tc.showX = false;
    tc.showY = false;
    // showZ stays true — only the Z arrow is visible
    tc.setSpace("local");
    tc.setSize(0.7);

    const tcHelper = tc.getHelper();
    tcHelper.visible = false; // hidden until an extrude object is selected
    scene.add(tcHelper);

    const anchor = new THREE.Object3D();
    anchor.name = "depth-handle-anchor";
    scene.add(anchor);

    // Drag state for depth handle
    let depthDragStartZ = 0;
    let depthDragStartDepth = 0;

    tc.addEventListener("dragging-changed", (event) => {
      const dragging = !!event.value;
      controls.enabled = !dragging;
      if (dragging) {
        // Drag started — record starting state
        depthDragStartZ = anchor.position.z;
        const id = depthObjectIdRef.current;
        const obj = id ? objectsRef.current.find((o) => o.id === id) : null;
        depthDragStartDepth = obj?.depth ?? 0.4;
      } else {
        // Drag ended — commit to undo history
        if (depthObjectIdRef.current) {
          commitDepthRef.current();
        }
      }
    });

    tc.addEventListener("change", () => {
      const id = depthObjectIdRef.current;
      if (!tc.dragging || !id) return;
      // Clamp anchor to only Z movement
      const obj = objectsRef.current.find((o) => o.id === id);
      if (!obj) return;
      anchor.position.x = obj.position[0];
      anchor.position.y = obj.position[1];
      const zDelta = anchor.position.z - depthDragStartZ;
      const newDepth = Math.max(0.05, Math.min(10, depthDragStartDepth + zDelta));
      depthChangeRef.current(id, newDepth);
    });

    tcRef.current = { tc, helper: tcHelper, anchor };

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
      // ── 3D Drawing Mode: left-click starts stroke on 3D shape or plane ──
      if (draw3DRef.current && drawStateRef.current) {
        if (e.button !== 0) return; // Allow right-click through to OrbitControls for rotation
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);

        const drawState = drawStateRef.current;

        // Check if user clicked directly on any existing 3D mesh in the scene
        const meshHits = raycaster.intersectObjects(
          group.children.filter((c) => c instanceof THREE.Mesh),
          false,
        );

        let localPt: THREE.Vector3;

        if (meshHits.length > 0) {
          const hit = meshHits[0]!;
          const hitMesh = hit.object as THREE.Mesh;
          const objId = hitMesh.userData["id"] as string | undefined;
          const targetObj = objectsRef.current.find((o) => o.id === objId) ?? null;

          // Compute surface normal in world space
          const worldNormal = hit.face
            ? hit.face.normal.clone().transformDirection(hitMesh.matrixWorld).normalize()
            : new THREE.Vector3(0, 1, 0);

          // Anchor drawing plane directly to the clicked face of the 3D shape!
          drawState.planeGroup.position.copy(hit.point);
          drawState.planeGroup.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            worldNormal,
          );
          drawState.planeGroup.updateMatrixWorld(true);

          drawState.surfaceMesh = hitMesh;
          drawState.surfaceObject = targetObj;
          drawState.surfaceNormal = worldNormal.clone();
          drawState.surfacePoint = hit.point.clone();

          // On this anchored plane, the click point is at local origin (0, 0)
          localPt = new THREE.Vector3(0, 0, 0);
        } else {
          // Clicked in free space: re-align plane to face camera if needed
          const target = controls.target.clone();
          drawState.planeGroup.position.copy(target);
          drawState.planeGroup.lookAt(camera.position);
          drawState.planeGroup.updateMatrixWorld(true);

          const hits = raycaster.intersectObject(drawState.planeMesh, false);
          if (hits.length === 0) return;
          const hit = hits[0]!;
          localPt = drawState.planeMesh.worldToLocal(hit.point.clone());

          drawState.surfaceMesh = null;
          drawState.surfaceObject = null;
          drawState.surfaceNormal = null;
          drawState.surfacePoint = null;
        }

        // Position start marker at this exact point
        drawState.startMarkerGroup.position.set(localPt.x, localPt.y, 0.03);
        drawState.startMarkerGroup.scale.set(1, 1, 1);
        drawState.startMarkerGroup.visible = true;

        const isCutMode = drawActionRef.current === "cut";
        const markerCol = isCutMode ? "#ef4444" : "#ff3b30";
        drawState.startMarkerSphere.material.color.set(markerCol);
        drawState.startMarkerRing.material.color.set(markerCol);
        drawState.startMarkerPin.material.color.set(markerCol);

        drawState.startPoint = { x: localPt.x, y: localPt.y };
        drawState.points = [{ x: localPt.x, y: localPt.y }];
        drawAnchorRef.current = { x: localPt.x, y: localPt.y };
        drawState.isDrawing = true;
        drawState.isClosed = false;

        drawState.hintSprite.visible = false;
        drawState.surfaceCursorGroup.visible = false;
        updateStrokeLine(drawState);

        renderer.domElement.setPointerCapture(e.pointerId);

        setHudCoords({ x: localPt.x, y: localPt.y });
        const targetName = drawState.surfaceObject?.name;
        setHudStatus(
          targetName
            ? isCutMode
              ? `Drawing cut on ${targetName}... bring line back to start marker to close & carve.`
              : `Drawing on ${targetName}... bring line back to start marker to close & extend.`
            : "Drawing... bring line back to start marker to close.",
        );
        setIsClosing(false);
        setStrokeLength(1);
        return;
      }

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
      // Let OrbitControls own touch gestures so one finger rotates and two
      // fingers dolly/pan instead of starting an object drag.
      if (e.pointerType === "touch") return;
      draggingId = id;
      controls.enabled = false;
      renderer.domElement.setPointerCapture(e.pointerId);
    };

    const onMove = (e: PointerEvent) => {
      // ── 3D Drawing Mode: hover detection on 3D meshes & stroke drawing ──
      if (draw3DRef.current && drawStateRef.current) {
        const drawState = drawStateRef.current;
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);

        const isCutMode = drawActionRef.current === "cut";

        if (!drawState.isDrawing) {
          // Hovering: detect if pointer is over any 3D mesh to show surface reticle
          const meshHits = raycaster.intersectObjects(
            group.children.filter((c) => c instanceof THREE.Mesh),
            false,
          );

          if (meshHits.length > 0) {
            const hit = meshHits[0]!;
            const hitMesh = hit.object as THREE.Mesh;
            const objId = hitMesh.userData["id"] as string | undefined;
            const targetObj = objectsRef.current.find((o) => o.id === objId);
            const worldNormal = hit.face
              ? hit.face.normal.clone().transformDirection(hitMesh.matrixWorld).normalize()
              : new THREE.Vector3(0, 1, 0);

            drawState.surfaceCursorGroup.visible = true;
            drawState.surfaceCursorGroup.position.copy(
              hit.point.clone().addScaledVector(worldNormal, 0.02),
            );
            // In cut mode, direction cone points inward into shape
            drawState.surfaceCursorGroup.quaternion.setFromUnitVectors(
              new THREE.Vector3(0, 0, 1),
              isCutMode ? worldNormal.clone().negate() : worldNormal,
            );

            drawState.surfaceCursorGroup.traverse((child) => {
              if (
                child instanceof THREE.Mesh &&
                child.material instanceof THREE.MeshBasicMaterial
              ) {
                child.material.color.set(isCutMode ? "#ef4444" : "#3b82f6");
              }
            });

            setHudStatus(
              isCutMode
                ? `[CUT MODE] Hovering on ${targetObj?.name ?? "3D shape"} — click to carve cut into surface`
                : `Hovering on ${targetObj?.name ?? "3D shape"} — click to draw & extend from this surface`,
            );
            return;
          } else {
            drawState.surfaceCursorGroup.visible = false;
          }
        }

        const hits = raycaster.intersectObject(drawState.planeMesh, false);
        if (hits.length > 0) {
          const hit = hits[0]!;
          const rawLocal = drawState.planeMesh.worldToLocal(hit.point.clone());
          let localPt = rawLocal;

          const isShift = e.shiftKey || shiftHeldRef.current;
          let snapAngle: number | null = null;
          if (isShift && drawAnchorRef.current) {
            const snapped = snapToAngle(
              { x: rawLocal.x, y: rawLocal.y },
              drawAnchorRef.current,
              45,
            );
            localPt = new THREE.Vector3(snapped.point.x, snapped.point.y, rawLocal.z);
            snapAngle = snapped.angleDegrees;
          }

          setHudCoords({ x: localPt.x, y: localPt.y });

          if (drawState.isDrawing && drawState.startPoint) {
            const last = drawState.points[drawState.points.length - 1];
            const dLast = last ? Math.hypot(localPt.x - last.x, localPt.y - last.y) : Infinity;
            if (dLast >= 0.04) {
              drawState.points.push({ x: localPt.x, y: localPt.y });
              updateStrokeLine(drawState);
              setStrokeLength(drawState.points.length);
              if (!isShift) {
                drawAnchorRef.current = { x: localPt.x, y: localPt.y };
              }
            }

            // Check closure distance against start point (proportional to plane size, points >= 12)
            const dStart = Math.hypot(
              localPt.x - drawState.startPoint.x,
              localPt.y - drawState.startPoint.y,
            );
            const closeThreshold = PLANE_SIZE * 0.14;
            const closed = drawState.points.length >= 12 && dStart <= closeThreshold;

            if (closed !== drawState.isClosed) {
              drawState.isClosed = closed;
              setIsClosing(closed);
              if (closed) {
                // Change marker color to green to indicate "release here to close"
                drawState.startMarkerSphere.material.color.set("#22c55e");
                drawState.startMarkerRing.material.color.set("#22c55e");
                drawState.startMarkerPin.material.color.set("#22c55e");
                drawState.startMarkerGroup.scale.set(1.3, 1.3, 1.3);
                setHudStatus(
                  isCutMode
                    ? "Release to close shape and carve cut!"
                    : "Release to close shape and extend!",
                );
              } else {
                const markerColor = isCutMode ? "#ef4444" : "#ff3b30";
                drawState.startMarkerSphere.material.color.set(markerColor);
                drawState.startMarkerRing.material.color.set(markerColor);
                drawState.startMarkerPin.material.color.set(markerColor);
                drawState.startMarkerGroup.scale.set(1, 1, 1);
                setHudStatus(
                  isShift && snapAngle !== null
                    ? `[Shift Snap ${snapAngle}°] Bring line back to start marker to close.`
                    : "Drawing... bring line back to the red start marker to close.",
                );
              }
            } else if (isShift && snapAngle !== null && !closed) {
              setHudStatus(`[Shift Snap ${snapAngle}°] Bring line back to start marker to close.`);
            }
          }
        } else if (!drawState.isDrawing) {
          setHudCoords(null);
        }
        return;
      }

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
      drawAnchorRef.current = null;
      if (draw3DRef.current && drawStateRef.current?.isDrawing) {
        drawStateRef.current.isDrawing = false;
        try {
          renderer.domElement.releasePointerCapture(e.pointerId);
        } catch {
          // Pointer capture may already have been released by the browser.
        }
        setIsClosing(false);
        return;
      }
      if (draggingId) renderer.domElement.releasePointerCapture(e.pointerId);
      draggingId = null;
      controls.enabled = true;
    };

    const onUp = (e: PointerEvent) => {
      drawAnchorRef.current = null;
      // ── 3D Drawing Mode: release handling ──
      if (draw3DRef.current && drawStateRef.current) {
        const drawState = drawStateRef.current;
        if (!drawState.isDrawing) return;

        drawState.isDrawing = false;
        try {
          renderer.domElement.releasePointerCapture(e.pointerId);
        } catch {
          // Pointer capture may already have been released by the browser.
        }

        if (drawState.isClosed && drawState.points.length >= 12 && drawState.startPoint) {
          // Closed outline! Connect back to exact start point
          const closedPoints = [...drawState.points, { ...drawState.startPoint }];

          // Coordinate conversion: map local (x, y) to outline format.
          // In plane local space, Y is positive upwards. In 2D canvas space, Y is positive downwards.
          // Inverting Y ensures the extruded geometry is oriented upright as drawn.
          const outline: Point[] = closedPoints.map((p) => ({
            x: p.x,
            y: -p.y,
          }));

          const DEPTH = 0.5;

          if (drawState.surfaceMesh && drawState.surfaceNormal) {
            // Calculate bounding box of the drawn points on the surface
            let minX = Infinity,
              maxX = -Infinity,
              minY = Infinity,
              maxY = -Infinity;
            for (const pt of closedPoints) {
              minX = Math.min(minX, pt.x);
              maxX = Math.max(maxX, pt.x);
              minY = Math.min(minY, pt.y);
              maxY = Math.max(maxY, pt.y);
            }
            const cx = (minX + maxX) / 2;
            const cy = (minY + maxY) / 2;
            const w = Math.max(maxX - minX, 0.3);
            const h = Math.max(maxY - minY, 0.3);
            const s = Math.max(0.2, Math.max(w, h) / 2);

            const isCutMode = drawActionRef.current === "cut";
            const targetObj = drawState.surfaceObject;
            const targetMesh = drawState.surfaceMesh;

            if (isCutMode && targetObj && targetMesh) {
              const CUT_DEPTH = 0.8;
              // Center of cutter in plane local space: penetrate inward into the shape along -Z
              const centerLocal = new THREE.Vector3(cx, cy, -CUT_DEPTH / 2 + 0.02);
              const worldCenter = drawState.planeGroup.localToWorld(centerLocal);
              const worldQuat = drawState.planeGroup.quaternion.clone();

              // Express cutter in parent mesh local space:
              targetMesh.updateMatrixWorld(true);
              const cutterWorldMatrix = new THREE.Matrix4().compose(
                worldCenter,
                worldQuat,
                new THREE.Vector3(s, s, 1),
              );
              const cutterLocalMatrix = targetMesh.matrixWorld
                .clone()
                .invert()
                .multiply(cutterWorldMatrix);

              const localPos = new THREE.Vector3();
              const localQuat = new THREE.Quaternion();
              const localScale = new THREE.Vector3();
              cutterLocalMatrix.decompose(localPos, localQuat, localScale);
              const localEuler = new THREE.Euler().setFromQuaternion(localQuat, "XYZ");

              const cutOp: CutOperation = {
                id: Math.random().toString(36).slice(2, 10),
                outline,
                depth: CUT_DEPTH,
                localTransform: {
                  position: [localPos.x, localPos.y, localPos.z],
                  rotation: [localEuler.x, localEuler.y, localEuler.z],
                  scale: [localScale.x, localScale.y, localScale.z],
                },
              };

              cut3DRef.current?.(targetObj.id, cutOp);
              setHudStatus(
                `Carved cut into ${targetObj.name}! Draw again to add more cuts, or toggle Extend.`,
              );
            } else {
              // Center of extrusion: offset by DEPTH / 2 + bevel along +Z so base sits flush against the face
              const BEVEL = 0.04;
              const centerLocal = new THREE.Vector3(cx, cy, DEPTH / 2 + BEVEL);
              const worldCenter = drawState.planeGroup.localToWorld(centerLocal);
              const euler = new THREE.Euler().setFromQuaternion(
                drawState.planeGroup.quaternion,
                "XYZ",
              );

              const parentName = drawState.surfaceObject?.name ?? "3D shape";
              extrude3DRef.current?.(outline, {
                position: [worldCenter.x, worldCenter.y, worldCenter.z],
                rotation: [euler.x, euler.y, euler.z],
                scale: [s, s, 1],
                name: `Extension of ${parentName}`,
              });

              setHudStatus(
                `Extended ${parentName}! Hover any 3D shape to draw & extend again, or click Exit.`,
              );
            }
          } else {
            // Free-space drawing
            extrude3DRef.current?.(outline);
            setHudStatus("Shape extruded! Hover any 3D shape to draw on it, or click Exit.");
          }

          resetDrawStroke(drawState);
          setIsClosing(false);
          setStrokeLength(0);
        } else {
          // Stroke did NOT close
          setHudStatus("Your outline isn't closed yet. Bring the line back to the start marker.");
          setIsClosing(false);
        }
        return;
      }

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

      // Clean up 3D drawing state if active
      if (drawStateRef.current) {
        const { planeGroup, surfaceCursorGroup } = drawStateRef.current;
        scene.remove(planeGroup);
        scene.remove(surfaceCursorGroup);
        surfaceCursorGroup.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry?.dispose();
            (child.material as THREE.Material)?.dispose();
          }
        });
        planeGroup.traverse((child) => {
          if (
            child instanceof THREE.Mesh ||
            child instanceof THREE.Line ||
            child instanceof THREE.Sprite
          ) {
            child.geometry?.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m.dispose());
            } else {
              child.material?.dispose();
            }
          }
        });
        drawStateRef.current = null;
      }

      // Clean up depth handle
      tc.detach();
      tc.dispose();
      scene.remove(tcHelper);
      scene.remove(anchor);
      tcRef.current = null;
      depthObjectIdRef.current = null;
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

    // ── Depth handle visibility & positioning ──────────────────
    const tcState = tcRef.current;
    if (tcState) {
      const selectedObj = selectedId ? objects.find((o) => o.id === selectedId) : null;

      if (!draw3DRef.current && selectedObj && selectedObj.kind === "extrude") {
        const depth = selectedObj.depth ?? 0.4;
        // Position anchor at the object's position, offset along Z by the full depth
        // (front face of the extrusion in local space)
        tcState.anchor.position.set(
          selectedObj.position[0],
          selectedObj.position[1],
          selectedObj.position[2] + depth,
        );
        tcState.anchor.rotation.set(...selectedObj.rotation);
        // Don't re-attach during an active drag — it would reset the anchor
        if (!tcState.tc.dragging) {
          tcState.tc.attach(tcState.anchor);
        }
        tcState.helper.visible = true;
        depthObjectIdRef.current = selectedObj.id;
      } else {
        tcState.tc.detach();
        tcState.helper.visible = false;
        depthObjectIdRef.current = null;
      }
    }
  }, [objects, selectedId, wireframe]);

  // ── Manage 3D drawing plane lifecycle ───────────────────────
  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;
    const { scene, camera, controls } = s;

    if (draw3D) {
      // Disable left-click orbit so left-drag draws on plane
      controls.mouseButtons.LEFT = null;
      // Allow right-click to orbit while in drawing mode
      controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;

      // Hide TransformControls depth helper while in drawing mode
      if (tcRef.current) {
        tcRef.current.tc.detach();
        tcRef.current.helper.visible = false;
      }

      const planeGroup = new THREE.Group();
      planeGroup.name = "draw3d-group";

      // Position plane at controls.target and billboard facing camera
      const target = controls.target.clone();
      planeGroup.position.copy(target);
      planeGroup.lookAt(camera.position);

      // Semi-transparent drawing plane surface
      const planeGeo = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE);
      const planeMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const planeMesh = new THREE.Mesh(planeGeo, planeMat);
      planeMesh.name = "draw3d-plane-surface";
      planeGroup.add(planeMesh);

      // Visible grid for scale and alignment reference
      const grid = new THREE.GridHelper(PLANE_SIZE, 24, 0x3b82f6, 0x93c5fd);
      grid.rotation.x = Math.PI / 2;
      grid.position.z = 0.002;
      if (Array.isArray(grid.material)) {
        grid.material.forEach((m) => {
          m.transparent = true;
          m.opacity = 0.75;
        });
      } else {
        grid.material.transparent = true;
        grid.material.opacity = 0.75;
      }
      planeGroup.add(grid);

      // Border outline around drawing plane
      const borderGeo = new THREE.EdgesGeometry(planeGeo);
      const borderMat = new THREE.LineBasicMaterial({
        color: 0x3b82f6,
        transparent: true,
        opacity: 0.85,
        linewidth: 2,
      });
      const border = new THREE.LineSegments(borderGeo, borderMat);
      border.position.z = 0.003;
      planeGroup.add(border);

      // Start marker group: sphere + ring highlight + pin
      const startMarkerGroup = new THREE.Group();
      startMarkerGroup.visible = false;
      startMarkerGroup.position.z = 0.03;
      startMarkerGroup.renderOrder = 10;

      const sphereGeo = new THREE.SphereGeometry(0.12, 24, 16);
      const sphereMat = new THREE.MeshBasicMaterial({ color: 0xff3b30, depthTest: false });
      const startMarkerSphere = new THREE.Mesh(sphereGeo, sphereMat);
      startMarkerGroup.add(startMarkerSphere);

      const ringGeo = new THREE.RingGeometry(0.18, 0.25, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xff3b30,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        depthTest: false,
      });
      const startMarkerRing = new THREE.Mesh(ringGeo, ringMat);
      startMarkerGroup.add(startMarkerRing);

      const pinGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 12);
      const pinMat = new THREE.MeshBasicMaterial({ color: 0xff3b30, depthTest: false });
      const startMarkerPin = new THREE.Mesh(pinGeo, pinMat);
      startMarkerPin.rotation.x = Math.PI / 2;
      startMarkerPin.position.z = 0.25;
      startMarkerGroup.add(startMarkerPin);

      planeGroup.add(startMarkerGroup);

      // Dynamic stroke line
      const lineGeo = new THREE.BufferGeometry();
      const lineMat = new THREE.LineBasicMaterial({
        color: 0xe0393e,
        linewidth: 3,
        depthTest: false,
      });
      const strokeLine = new THREE.Line(lineGeo, lineMat);
      strokeLine.position.z = 0.025;
      strokeLine.renderOrder = 9;
      planeGroup.add(strokeLine);

      // In-scene billboard text sprite for initial guidance
      const labelCanvas = document.createElement("canvas");
      labelCanvas.width = 512;
      labelCanvas.height = 128;
      const ctx = labelCanvas.getContext("2d")!;
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.beginPath();
      ctx.roundRect(16, 16, 480, 96, 24);
      ctx.fill();
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Click & drag to start drawing", 256, 64);
      const labelTexture = new THREE.CanvasTexture(labelCanvas);
      const spriteMat = new THREE.SpriteMaterial({ map: labelTexture, transparent: true });
      const hintSprite = new THREE.Sprite(spriteMat);
      hintSprite.scale.set(3.2, 0.8, 1);
      hintSprite.position.set(0, PLANE_SIZE / 2 + 0.55, 0.05);
      planeGroup.add(hintSprite);

      scene.add(planeGroup);

      // 3D Surface hover reticle (ring + center dot + normal pointer)
      const surfaceCursorGroup = new THREE.Group();
      surfaceCursorGroup.name = "draw3d-surface-cursor";
      surfaceCursorGroup.visible = false;
      surfaceCursorGroup.renderOrder = 20;

      const cursorRingGeo = new THREE.RingGeometry(0.18, 0.26, 32);
      const cursorRingMat = new THREE.MeshBasicMaterial({
        color: 0x3b82f6,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        depthTest: false,
      });
      const cursorRing = new THREE.Mesh(cursorRingGeo, cursorRingMat);
      surfaceCursorGroup.add(cursorRing);

      const cursorDotGeo = new THREE.SphereGeometry(0.04, 16, 12);
      const cursorDotMat = new THREE.MeshBasicMaterial({
        color: 0x60a5fa,
        depthTest: false,
      });
      const cursorDot = new THREE.Mesh(cursorDotGeo, cursorDotMat);
      surfaceCursorGroup.add(cursorDot);

      const cursorConeGeo = new THREE.ConeGeometry(0.06, 0.28, 16);
      const cursorConeMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        depthTest: false,
      });
      const cursorCone = new THREE.Mesh(cursorConeGeo, cursorConeMat);
      cursorCone.rotation.x = Math.PI / 2;
      cursorCone.position.z = 0.14;
      surfaceCursorGroup.add(cursorCone);

      scene.add(surfaceCursorGroup);

      drawStateRef.current = {
        planeGroup,
        planeMesh,
        startMarkerGroup,
        startMarkerSphere,
        startMarkerRing,
        startMarkerPin,
        strokeLine,
        hintSprite,
        surfaceCursorGroup,
        surfaceMesh: null,
        surfaceObject: null,
        surfaceNormal: null,
        surfacePoint: null,
        points: [],
        isDrawing: false,
        startPoint: null,
        isClosed: false,
      };

      setHudCoords(null);
      setHudStatus("Click & drag on the grid to start drawing");
      setIsClosing(false);
      setStrokeLength(0);
    } else {
      if (drawStateRef.current) {
        const { planeGroup, surfaceCursorGroup } = drawStateRef.current;
        scene.remove(planeGroup);
        scene.remove(surfaceCursorGroup);
        surfaceCursorGroup.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry?.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m.dispose());
            } else {
              child.material?.dispose();
            }
          }
        });
        planeGroup.traverse((child) => {
          if (
            child instanceof THREE.Mesh ||
            child instanceof THREE.Line ||
            child instanceof THREE.Sprite
          ) {
            child.geometry?.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m.dispose());
            } else {
              child.material?.dispose();
            }
          }
        });
        drawStateRef.current = null;
      }
      controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
      controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
      setHudCoords(null);
      setHudStatus("Click & drag on the grid to start drawing");
      setIsClosing(false);
      setStrokeLength(0);
    }
  }, [draw3D]);

  const handleClearStroke = useCallback(() => {
    if (drawStateRef.current) {
      resetDrawStroke(drawStateRef.current);
      setHudCoords(null);
      setHudStatus("Click & drag on the grid to start drawing");
      setIsClosing(false);
      setStrokeLength(0);
    }
  }, []);

  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;
    s.camera.position.set(20.5, 12.5, 22.5);
    s.controls.target.set(0, 1.5, -2.5);
    s.controls.update();
  }, [resetToken]);

  useEffect(() => {
    if (stateRef.current) {
      stateRef.current.decor.visible = showEnvironment;
      stateRef.current.grid.visible = !showEnvironment;
    }
  }, [showEnvironment]);

  return (
    <div ref={hostRef} className="relative h-full w-full touch-none">
      {/* 3D Drawing HUD Overlay */}
      {draw3D && (
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3.5 select-none">
          {/* Top Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-md">
                <Pencil className="h-3.5 w-3.5" /> 3D Drawing Mode
              </span>

              {/* Action Toggle: Extend vs Cut */}
              <div className="pointer-events-auto flex items-center rounded-xl border border-border bg-background/90 p-0.5 shadow-sm backdrop-blur">
                <button
                  type="button"
                  onClick={() => setDrawAction("extend")}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    drawAction === "extend"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Extend: adds material outwards (Hotkey: C)"
                >
                  Extend ⇗
                </button>
                <button
                  type="button"
                  onClick={() => setDrawAction("cut")}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    drawAction === "cut"
                      ? "bg-destructive text-destructive-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Cut: carves material inward (Hotkey: C)"
                >
                  Cut ⇘
                </button>
              </div>

              {shiftActive && (
                <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary backdrop-blur">
                  Shift: 45° Snap ON
                </span>
              )}

              {hudCoords && (
                <span className="rounded-full border border-border/80 bg-background/90 px-2.5 py-0.5 text-xs font-mono font-semibold text-foreground shadow-sm backdrop-blur">
                  X: {hudCoords.x.toFixed(2)} · Y: {hudCoords.y.toFixed(2)}
                </span>
              )}
            </div>

            <div className="pointer-events-auto flex items-center gap-1.5">
              {strokeLength > 0 && (
                <button
                  type="button"
                  onClick={handleClearStroke}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background/90 px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm backdrop-blur transition hover:bg-muted"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => onToggleDraw3D?.(false)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background/90 px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm backdrop-blur transition hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" /> Exit
              </button>
            </div>
          </div>

          {/* Bottom Guidance Pill */}
          <div className="flex flex-col items-center gap-1">
            <div
              className={`rounded-2xl px-4 py-2 text-center text-xs font-semibold shadow-md backdrop-blur transition-all ${
                isClosing
                  ? "border border-success/50 bg-success text-success-foreground scale-105"
                  : hudStatus.includes("isn't closed")
                    ? "border border-destructive/50 bg-destructive text-destructive-foreground"
                    : drawAction === "cut"
                      ? "border border-destructive/40 bg-background/95 text-destructive"
                      : "border border-border/80 bg-background/90 text-foreground"
              }`}
            >
              {hudStatus}
            </div>
            <p className="text-[11px] text-muted-foreground/80 font-medium">
              Hold{" "}
              <kbd className="rounded border bg-background/80 px-1 py-0.5 font-mono text-[10px]">
                Shift
              </kbd>{" "}
              to snap angles · Press{" "}
              <kbd className="rounded border bg-background/80 px-1 py-0.5 font-mono text-[10px]">
                C
              </kbd>{" "}
              to toggle Extend/Cut
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
