import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";

export type OpticalBenchHandle = {
  clear: () => void;
};

type Point = {
  x: number;
  y: number;
};

type CameraConfig = {
  position: Point3;
  target: Point3;
  fov: number;
};

type Point3 = {
  x: number;
  y: number;
  z: number;
};

type SceneState = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  inputMesh: THREE.Mesh;
  inputCanvas: HTMLCanvasElement;
  inputTexture: THREE.CanvasTexture;
  lensCanvases: HTMLCanvasElement[];
  lensTextures: THREE.CanvasTexture[];
  outputCanvas: HTMLCanvasElement;
  outputTexture: THREE.CanvasTexture;
  confidence: number[];
  targetConfidence: number[];
  hasInk: boolean;
  activePointerId: number | null;
  lastInkPoint: Point | null;
  animationFrame: number;
  onInkChange: (hasInk: boolean) => void;
};

const INPUT_SIZE = 512;
const TEXTURE_SIZE = 512;
const DIGITS = 10;

const DEFAULT_CAMERA: CameraConfig = {
  position: { x: -2.7, y: 1.22, z: 6.2 },
  target: { x: -0.28, y: -0.02, z: -0.04 },
  fov: 48,
};

const OPTICAL_AXIS = new THREE.Vector3(1, 0, -0.14).normalize();
const SURFACE_ROTATION = new THREE.Quaternion().setFromUnitVectors(
  new THREE.Vector3(0, 0, 1),
  OPTICAL_AXIS,
);
const OUTPUT_ROTATION = new THREE.Quaternion().setFromUnitVectors(
  new THREE.Vector3(0, 0, 1),
  OPTICAL_AXIS.clone().negate(),
);
const SURFACE_STOPS = [-2.65, -1.28, -0.42, 0.44, 1.3, 2.65];
const lensStops = SURFACE_STOPS.slice(1, 5);

const digitAnchors = Array.from({ length: DIGITS }, (_, index) => {
  const angle = -Math.PI / 2 + (index / DIGITS) * Math.PI * 2;
  return {
    x: 0.5 + Math.cos(angle) * 0.31,
    y: 0.5 + Math.sin(angle) * 0.31,
  };
});

function pointOnAxis(distance: number, y = 0) {
  return OPTICAL_AXIS.clone().multiplyScalar(distance).setY(y);
}

function applySurfaceRotation(object: THREE.Object3D) {
  object.quaternion.copy(SURFACE_ROTATION);
}

function createCanvas(size = TEXTURE_SIZE) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function circleMask(ctx: CanvasRenderingContext2D, size: number) {
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.48, 0, Math.PI * 2);
  ctx.clip();
}

function resetInputCanvas(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawInputStroke(
  canvas: HTMLCanvasElement,
  from: Point | null,
  to: Point,
) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;

  ctx.save();
  circleMask(ctx, canvas.width);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(27, 128, 150, 0.82)";
  ctx.shadowColor = "rgba(34, 185, 215, 0.45)";
  ctx.shadowBlur = 18;
  ctx.lineWidth = 38;
  ctx.beginPath();
  ctx.moveTo(from?.x ?? to.x, from?.y ?? to.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();
}

function measureInk(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { amount: 0, cx: 0.5, cy: 0.5, verticality: 0, openness: 0 };
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let amount = 0;
  let sx = 0;
  let sy = 0;
  let left = 0;
  let right = 0;
  let top = 0;
  let bottom = 0;

  for (let y = 0; y < canvas.height; y += 6) {
    for (let x = 0; x < canvas.width; x += 6) {
      const alpha = data[(y * canvas.width + x) * 4 + 3] / 255;
      if (alpha < 0.02) continue;
      amount += alpha;
      sx += x * alpha;
      sy += y * alpha;
      if (x < canvas.width * 0.42) left += alpha;
      if (x > canvas.width * 0.58) right += alpha;
      if (y < canvas.height * 0.38) top += alpha;
      if (y > canvas.height * 0.62) bottom += alpha;
    }
  }

  if (amount <= 0) {
    return { amount: 0, cx: 0.5, cy: 0.5, verticality: 0, openness: 0 };
  }

  const cx = sx / amount / canvas.width;
  const cy = sy / amount / canvas.height;
  const verticality = Math.abs(top - bottom) / amount;
  const openness = Math.abs(left - right) / amount;
  return { amount, cx, cy, verticality, openness };
}

function estimateConfidence(canvas: HTMLCanvasElement) {
  const ink = measureInk(canvas);
  if (ink.amount <= 0) return Array(DIGITS).fill(0);

  const features = [
    Math.abs(ink.cx - 0.5),
    ink.cy,
    ink.verticality,
    ink.openness,
    Math.min(1, ink.amount / 620),
  ];

  const weights = [
    [0.12, 0.58, 0.22, 0.17, 0.62],
    [0.03, 0.46, 0.88, 0.2, 0.32],
    [0.52, 0.34, 0.42, 0.73, 0.54],
    [0.42, 0.52, 0.48, 0.64, 0.58],
    [0.3, 0.42, 0.76, 0.47, 0.45],
    [0.48, 0.58, 0.37, 0.69, 0.61],
    [0.55, 0.64, 0.45, 0.53, 0.7],
    [0.16, 0.25, 0.82, 0.25, 0.34],
    [0.28, 0.5, 0.36, 0.22, 0.86],
    [0.38, 0.38, 0.44, 0.58, 0.72],
  ];

  const raw = weights.map((digitWeights, digit) => {
    const score = digitWeights.reduce(
      (sum, weight, index) => sum + weight * features[index],
      0,
    );
    return Math.exp(
      score * 2.2 + Math.sin((digit + 1) * 1.71 + ink.cx * 3.2) * 0.45,
    );
  });
  const total = raw.reduce((sum, value) => sum + value, 0);
  return raw.map((value) => value / total);
}

function drawLensTexture(
  canvas: HTMLCanvasElement,
  source: HTMLCanvasElement,
  layer: number,
  hasInk: boolean,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const size = canvas.width;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  circleMask(ctx, size);

  const base = ctx.createRadialGradient(
    size * 0.42,
    size * 0.36,
    10,
    size / 2,
    size / 2,
    size * 0.52,
  );
  base.addColorStop(0, "rgba(255, 255, 255, 0.32)");
  base.addColorStop(0.55, "rgba(185, 232, 238, 0.12)");
  base.addColorStop(1, "rgba(118, 176, 188, 0.04)");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  ctx.globalCompositeOperation = "source-over";
  ctx.lineWidth = 1.15;
  for (let i = 0; i < 36; i += 1) {
    const radius = size * (0.08 + i * 0.0115);
    const phase = layer * 0.8 + i * 0.34;
    ctx.beginPath();
    for (let t = 0; t <= Math.PI * 2 + 0.02; t += 0.035) {
      const wobble =
        Math.sin(t * (2 + layer) + phase) * size * 0.0055 +
        Math.sin(t * 7 - phase * 1.7) * size * 0.0022;
      const r = radius + wobble;
      const x = size / 2 + Math.cos(t) * r;
      const y = size / 2 + Math.sin(t) * r;
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    const alpha = 0.08 + (i % 3) * 0.028;
    ctx.strokeStyle = `rgba(55, 122, 138, ${alpha})`;
    ctx.stroke();
  }

  if (hasInk) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.filter = `blur(${10 + layer * 4}px)`;
    const dx = Math.sin(layer * 1.3) * 24;
    const dy = Math.cos(layer * 1.1) * 18;
    ctx.globalAlpha = 0.35 + layer * 0.08;
    ctx.drawImage(source, dx, dy, size, size);
    ctx.filter = "none";
    ctx.globalAlpha = 0.18;
    ctx.drawImage(source, -dx * 0.45, -dy * 0.45, size, size);
    ctx.restore();
  } else {
    const idle = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size * 0.42,
    );
    idle.addColorStop(0, "rgba(150, 214, 225, 0.08)");
    idle.addColorStop(1, "rgba(150, 214, 225, 0)");
    ctx.fillStyle = idle;
    ctx.fillRect(0, 0, size, size);
  }

  ctx.restore();
}

function drawOutputTexture(
  canvas: HTMLCanvasElement,
  confidence: number[],
  hasInk: boolean,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const size = canvas.width;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#f7fbfc";
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  circleMask(ctx, size);
  const paper = ctx.createRadialGradient(
    size * 0.45,
    size * 0.35,
    20,
    size / 2,
    size / 2,
    size * 0.55,
  );
  paper.addColorStop(0, "#ffffff");
  paper.addColorStop(0.72, "#eef4f5");
  paper.addColorStop(1, "#dfe8ea");
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, size, size);

  for (let digit = 0; digit < DIGITS; digit += 1) {
    const anchor = digitAnchors[digit];
    const x = anchor.x * size;
    const y = anchor.y * size;
    const strength = hasInk ? confidence[digit] : 0.012;
    const glow = ctx.createRadialGradient(
      x,
      y,
      4,
      x,
      y,
      size * (0.08 + strength * 0.24),
    );
    glow.addColorStop(0, `rgba(56, 184, 220, ${0.36 + strength * 2.4})`);
    glow.addColorStop(0.35, `rgba(154, 224, 235, ${0.14 + strength * 0.95})`);
    glow.addColorStop(1, "rgba(154, 224, 235, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "650 50px Inter, ui-sans-serif, system-ui";
  for (let digit = 0; digit < DIGITS; digit += 1) {
    const anchor = digitAnchors[digit];
    const x = anchor.x * size;
    const y = anchor.y * size;
    ctx.fillStyle = "rgba(36, 52, 56, 0.9)";
    ctx.fillText(String(digit), x, y);
  }

  ctx.strokeStyle = "rgba(88, 120, 128, 0.12)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.45, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function makeGlassMaterial(texture: THREE.Texture, opacity: number) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#f9feff"),
    map: texture,
    transparent: true,
    opacity,
    roughness: 0.18,
    metalness: 0,
    transmission: 0.4,
    thickness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

function applyCamera(camera: THREE.PerspectiveCamera, config: CameraConfig) {
  camera.position.set(config.position.x, config.position.y, config.position.z);
  camera.fov = config.fov;
  camera.lookAt(config.target.x, config.target.y, config.target.z);
  camera.updateProjectionMatrix();
}

function createScene(
  container: HTMLDivElement,
  onInkChange: (hasInk: boolean) => void,
  cameraConfig: CameraConfig,
): SceneState {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor("#f4f7f8");
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#f4f7f8");

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  applyCamera(camera, cameraConfig);

  const ambient = new THREE.HemisphereLight("#ffffff", "#d8e4e7", 2.6);
  scene.add(ambient);

  const key = new THREE.DirectionalLight("#ffffff", 3.8);
  key.position.set(-2.7, 4.1, 3.8);
  scene.add(key);

  const fill = new THREE.PointLight("#d9fbff", 12, 7);
  fill.position.set(2.9, 1.8, 2.4);
  scene.add(fill);

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: "#f2f5f6",
    roughness: 0.82,
  });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 5.3), wallMaterial);
  wall.position.set(0.3, 0, -1.18);
  scene.add(wall);

  const shelf = new THREE.Mesh(
    new THREE.PlaneGeometry(9.5, 3.1),
    new THREE.MeshStandardMaterial({ color: "#e8eef0", roughness: 0.78 }),
  );
  shelf.rotation.x = -Math.PI / 2;
  shelf.position.set(0.3, -1.55, 0.35);
  scene.add(shelf);

  const inputCanvas = createCanvas(INPUT_SIZE);
  const inputTexture = new THREE.CanvasTexture(inputCanvas);
  inputTexture.colorSpace = THREE.SRGBColorSpace;
  const inputMaterial = makeGlassMaterial(inputTexture, 0.82);
  const circleGeometry = new THREE.CircleGeometry(0.52, 128);
  const inputMesh = new THREE.Mesh(circleGeometry, inputMaterial);
  inputMesh.position.copy(pointOnAxis(SURFACE_STOPS[0]));
  applySurfaceRotation(inputMesh);
  scene.add(inputMesh);

  const inputRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.525, 0.009, 12, 160),
    new THREE.MeshBasicMaterial({
      color: "#b7dce4",
      transparent: true,
      opacity: 0.74,
    }),
  );
  inputRim.position.copy(inputMesh.position);
  inputRim.quaternion.copy(inputMesh.quaternion);
  scene.add(inputRim);

  const lensCanvases = lensStops.map(() => createCanvas());
  const lensTextures = lensCanvases.map((canvas) => {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  });

  lensTextures.forEach((texture, index) => {
    drawLensTexture(lensCanvases[index], inputCanvas, index + 1, false);
    texture.needsUpdate = true;
    const lens = new THREE.Mesh(
      new THREE.CircleGeometry(0.52, 160),
      makeGlassMaterial(texture, 0.54),
    );
    lens.position.copy(
      pointOnAxis(lensStops[index], Math.sin(index * 0.6) * 0.035),
    );
    applySurfaceRotation(lens);
    scene.add(lens);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.525, 0.009, 12, 160),
      new THREE.MeshBasicMaterial({
        color: "#c7e0e5",
        transparent: true,
        opacity: 0.78,
      }),
    );
    rim.position.copy(lens.position);
    rim.quaternion.copy(lens.quaternion);
    scene.add(rim);
  });

  const outputCanvas = createCanvas();
  const outputTexture = new THREE.CanvasTexture(outputCanvas);
  outputTexture.colorSpace = THREE.SRGBColorSpace;
  drawOutputTexture(outputCanvas, Array(DIGITS).fill(0), false);
  outputTexture.needsUpdate = true;

  const output = new THREE.Mesh(
    new THREE.CircleGeometry(0.64, 160),
    new THREE.MeshBasicMaterial({
      color: "#ffffff",
      map: outputTexture,
      side: THREE.FrontSide,
    }),
  );
  output.position.copy(pointOnAxis(SURFACE_STOPS[5]));
  output.quaternion.copy(OUTPUT_ROTATION);
  scene.add(output);

  const outputRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.645, 0.01, 12, 160),
    new THREE.MeshBasicMaterial({
      color: "#cfdcdf",
      transparent: true,
      opacity: 0.74,
    }),
  );
  outputRim.position.copy(output.position);
  outputRim.quaternion.copy(output.quaternion);
  scene.add(outputRim);

  return {
    renderer,
    scene,
    camera,
    raycaster: new THREE.Raycaster(),
    pointer: new THREE.Vector2(),
    inputMesh,
    inputCanvas,
    inputTexture,
    lensCanvases,
    lensTextures,
    outputCanvas,
    outputTexture,
    confidence: Array(DIGITS).fill(0),
    targetConfidence: Array(DIGITS).fill(0),
    hasInk: false,
    activePointerId: null,
    lastInkPoint: null,
    animationFrame: 0,
    onInkChange,
  };
}

function updateTextures(state: SceneState) {
  state.lensCanvases.forEach((canvas, index) => {
    drawLensTexture(canvas, state.inputCanvas, index + 1, state.hasInk);
    state.lensTextures[index].needsUpdate = true;
  });
  drawOutputTexture(state.outputCanvas, state.confidence, state.hasInk);
  state.outputTexture.needsUpdate = true;
}

function resize(container: HTMLDivElement, state: SceneState) {
  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight);
  state.renderer.setSize(width, height, false);
  state.camera.aspect = width / height;
  state.camera.updateProjectionMatrix();
}

function readNumber(value: string, fallback: number) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function isDebugMode() {
  return new URLSearchParams(window.location.search).get("debug") === "1";
}

function pointOnInput(
  event: PointerEvent,
  container: HTMLDivElement,
  state: SceneState,
) {
  const rect = container.getBoundingClientRect();
  state.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  state.pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  state.raycaster.setFromCamera(state.pointer, state.camera);
  const [hit] = state.raycaster.intersectObject(state.inputMesh);
  if (!hit?.uv) return null;

  const x = hit.uv.x * INPUT_SIZE;
  const y = (1 - hit.uv.y) * INPUT_SIZE;
  const dx = x - INPUT_SIZE / 2;
  const dy = y - INPUT_SIZE / 2;
  if (Math.sqrt(dx * dx + dy * dy) > INPUT_SIZE * 0.48) return null;
  return { x, y };
}

function animate(state: SceneState) {
  for (let i = 0; i < DIGITS; i += 1) {
    state.confidence[i] +=
      (state.targetConfidence[i] - state.confidence[i]) * 0.08;
  }
  updateTextures(state);
  state.renderer.render(state.scene, state.camera);
  state.animationFrame = window.requestAnimationFrame(() => animate(state));
}

export const OpticalBenchCanvas = forwardRef<
  OpticalBenchHandle,
  { onInkChange: (hasInk: boolean) => void }
>(function OpticalBenchCanvas({ onInkChange }, ref) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<SceneState | null>(null);
  const debug = useMemo(isDebugMode, []);
  const [cameraConfig, setCameraConfig] =
    useState<CameraConfig>(DEFAULT_CAMERA);

  useImperativeHandle(ref, () => ({
    clear: () => {
      const state = stateRef.current;
      if (!state) return;
      resetInputCanvas(state.inputCanvas);
      state.inputTexture.needsUpdate = true;
      state.hasInk = false;
      state.targetConfidence = Array(DIGITS).fill(0);
      state.lastInkPoint = null;
      state.onInkChange(false);
    },
  }));

  const updateCameraValue = useCallback(
    (section: "position" | "target", axis: keyof Point3, value: string) => {
      setCameraConfig((config) => ({
        ...config,
        [section]: {
          ...config[section],
          [axis]: readNumber(value, config[section][axis]),
        },
      }));
    },
    [],
  );

  const resetCamera = useCallback(() => {
    setCameraConfig(DEFAULT_CAMERA);
  }, []);

  const copyCamera = useCallback(() => {
    const value = `camera={ position:[${cameraConfig.position.x}, ${cameraConfig.position.y}, ${cameraConfig.position.z}], target:[${cameraConfig.target.x}, ${cameraConfig.target.y}, ${cameraConfig.target.z}], fov:${cameraConfig.fov} }`;
    void navigator.clipboard?.writeText(value);
    console.log(value);
  }, [cameraConfig]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const state = createScene(container, onInkChange, cameraConfig);
    stateRef.current = state;
    resize(container, state);
    animate(state);

    const handleResize = () => resize(container, state);
    const handlePointerDown = (event: PointerEvent) => {
      const point = pointOnInput(event, container, state);
      if (!point) return;
      event.preventDefault();
      state.activePointerId = event.pointerId;
      state.lastInkPoint = point;
      drawInputStroke(state.inputCanvas, null, point);
      state.inputTexture.needsUpdate = true;
      state.hasInk = true;
      state.targetConfidence = estimateConfidence(state.inputCanvas);
      state.onInkChange(true);
      state.renderer.domElement.setPointerCapture(event.pointerId);
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (state.activePointerId !== event.pointerId) return;
      const point = pointOnInput(event, container, state);
      if (!point) return;
      event.preventDefault();
      drawInputStroke(state.inputCanvas, state.lastInkPoint, point);
      state.lastInkPoint = point;
      state.inputTexture.needsUpdate = true;
      state.hasInk = true;
      state.targetConfidence = estimateConfidence(state.inputCanvas);
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (state.activePointerId !== event.pointerId) return;
      state.activePointerId = null;
      state.lastInkPoint = null;
      state.renderer.domElement.releasePointerCapture(event.pointerId);
    };

    window.addEventListener("resize", handleResize);
    state.renderer.domElement.addEventListener(
      "pointerdown",
      handlePointerDown,
    );
    state.renderer.domElement.addEventListener(
      "pointermove",
      handlePointerMove,
    );
    state.renderer.domElement.addEventListener("pointerup", handlePointerUp);
    state.renderer.domElement.addEventListener(
      "pointercancel",
      handlePointerUp,
    );

    return () => {
      window.cancelAnimationFrame(state.animationFrame);
      window.removeEventListener("resize", handleResize);
      state.renderer.domElement.removeEventListener(
        "pointerdown",
        handlePointerDown,
      );
      state.renderer.domElement.removeEventListener(
        "pointermove",
        handlePointerMove,
      );
      state.renderer.domElement.removeEventListener(
        "pointerup",
        handlePointerUp,
      );
      state.renderer.domElement.removeEventListener(
        "pointercancel",
        handlePointerUp,
      );
      state.renderer.dispose();
      state.renderer.domElement.remove();
      stateRef.current = null;
    };
  }, [onInkChange]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    applyCamera(state.camera, cameraConfig);
  }, [cameraConfig]);

  return (
    <>
      <div
        ref={containerRef}
        className="bench-canvas"
        aria-label="Optical bench drawing surface"
      />
      {debug ? (
        <aside className="camera-debug" aria-label="Camera debug controls">
          <div className="camera-debug__row camera-debug__header">
            <span>camera</span>
            <button type="button" onClick={copyCamera}>
              copy
            </button>
            <button type="button" onClick={resetCamera}>
              reset
            </button>
          </div>
          {(["position", "target"] as const).map((section) => (
            <fieldset key={section}>
              <legend>{section}</legend>
              {(["x", "y", "z"] as const).map((axis) => (
                <label key={axis}>
                  <span>{axis}</span>
                  <input
                    type="number"
                    step="0.01"
                    value={cameraConfig[section][axis]}
                    onChange={(event) =>
                      updateCameraValue(section, axis, event.target.value)
                    }
                  />
                </label>
              ))}
            </fieldset>
          ))}
          <fieldset>
            <legend>lens</legend>
            <label>
              <span>fov</span>
              <input
                type="number"
                step="0.1"
                min="10"
                max="75"
                value={cameraConfig.fov}
                onChange={(event) =>
                  setCameraConfig((config) => ({
                    ...config,
                    fov: readNumber(event.target.value, config.fov),
                  }))
                }
              />
            </label>
          </fieldset>
        </aside>
      ) : null}
    </>
  );
});
