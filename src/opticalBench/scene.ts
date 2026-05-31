import * as THREE from "three";
import {
  DIGITS,
  INPUT_SIZE,
  INPUT_SURFACE_RADIUS,
  LENS_STOPS,
  OPTICAL_AXIS,
  OUTPUT_ROTATION,
  SURFACE_ROTATION,
  SURFACE_STOPS,
} from "./constants";
import { createCanvas } from "./canvas";
import { smoothConfidence } from "./confidence";
import {
  drawInputSurfaceTexture,
  drawLensBaseTexture,
  drawLensTexture,
  drawOutputTexture,
} from "./textures";
import type { CameraConfig, SceneState } from "./types";

function pointOnAxis(distance: number, y = 0) {
  return OPTICAL_AXIS.clone().multiplyScalar(distance).setY(y);
}

function applySurfaceRotation(object: THREE.Object3D) {
  object.quaternion.copy(SURFACE_ROTATION);
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

export function applyCamera(
  camera: THREE.PerspectiveCamera,
  config: CameraConfig,
) {
  camera.position.set(config.position.x, config.position.y, config.position.z);
  camera.fov = config.fov;
  camera.lookAt(config.target.x, config.target.y, config.target.z);
  camera.updateProjectionMatrix();
}

export function createScene(
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
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 5.6), wallMaterial);
  wall.position.set(0, 0.08, -3.18);
  scene.add(wall);

  const shelf = new THREE.Mesh(
    new THREE.PlaneGeometry(5.8, 7),
    new THREE.MeshStandardMaterial({ color: "#e8eef0", roughness: 0.78 }),
  );
  shelf.rotation.x = -Math.PI / 2;
  shelf.position.set(0, -1.42, -0.15);
  scene.add(shelf);

  const inputCanvas = createCanvas(INPUT_SIZE);
  const inputSurfaceCanvas = createCanvas(INPUT_SIZE);
  drawInputSurfaceTexture(inputSurfaceCanvas, null, false);
  const inputTexture = new THREE.CanvasTexture(inputSurfaceCanvas);
  inputTexture.colorSpace = THREE.SRGBColorSpace;
  const inputMaterial = makeGlassMaterial(inputTexture, 0.82);
  const circleGeometry = new THREE.CircleGeometry(INPUT_SURFACE_RADIUS, 128);
  const inputMesh = new THREE.Mesh(circleGeometry, inputMaterial);
  inputMesh.position.copy(pointOnAxis(SURFACE_STOPS[0]));
  applySurfaceRotation(inputMesh);
  scene.add(inputMesh);

  const inputRim = new THREE.Mesh(
    new THREE.TorusGeometry(INPUT_SURFACE_RADIUS + 0.005, 0.009, 12, 160),
    new THREE.MeshBasicMaterial({
      color: "#b7dce4",
      transparent: true,
      opacity: 0.74,
    }),
  );
  inputRim.position.copy(inputMesh.position);
  inputRim.quaternion.copy(inputMesh.quaternion);
  scene.add(inputRim);

  const lensBaseCanvases = LENS_STOPS.map((_, index) => {
    const canvas = createCanvas();
    drawLensBaseTexture(canvas, index + 1);
    return canvas;
  });
  const lensCanvases = LENS_STOPS.map(() => createCanvas());
  const lensTextures = lensCanvases.map((canvas) => {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  });

  lensTextures.forEach((texture, index) => {
    drawLensTexture(
      lensCanvases[index],
      lensBaseCanvases[index],
      [],
      Array(DIGITS).fill(0),
      index + 1,
      false,
    );
    texture.needsUpdate = true;
    const lens = new THREE.Mesh(
      new THREE.CircleGeometry(0.52, 160),
      makeGlassMaterial(texture, 0.54),
    );
    lens.position.copy(pointOnAxis(LENS_STOPS[index]));
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
    inputSurfaceCanvas,
    inputTexture,
    inputLightSamples: [],
    normalizedInput: null,
    textureDirty: false,
    lensBaseCanvases,
    lensCanvases,
    lensTextures,
    outputCanvas,
    outputTexture,
    confidence: Array(DIGITS).fill(0),
    targetConfidence: Array(DIGITS).fill(0),
    classificationRequestId: 0,
    classificationInFlight: false,
    classificationQueued: false,
    hasInk: false,
    animationFrame: 0,
    onInkChange,
  };
}

export function updateTextures(state: SceneState) {
  drawInputSurfaceTexture(
    state.inputSurfaceCanvas,
    state.normalizedInput,
    state.hasInk,
    state.inputCanvas,
  );
  state.inputTexture.needsUpdate = true;
  state.lensCanvases.forEach((canvas, index) => {
    drawLensTexture(
      canvas,
      state.lensBaseCanvases[index],
      state.inputLightSamples,
      state.confidence,
      index + 1,
      state.hasInk,
    );
    state.lensTextures[index].needsUpdate = true;
  });
  drawOutputTexture(state.outputCanvas, state.confidence, state.hasInk);
  state.outputTexture.needsUpdate = true;
  state.textureDirty = false;
}

export function resize(container: HTMLDivElement, state: SceneState) {
  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight);
  state.renderer.setSize(width, height, false);
  state.camera.aspect = width / height;
  state.camera.updateProjectionMatrix();
}

export function animate(state: SceneState) {
  const confidenceChanged = smoothConfidence(state);
  if (state.textureDirty || confidenceChanged) {
    updateTextures(state);
  }
  state.renderer.render(state.scene, state.camera);
  state.animationFrame = window.requestAnimationFrame(() => animate(state));
}
