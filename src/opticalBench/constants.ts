import * as THREE from "three";
import type { CameraConfig } from "./types";

export const INPUT_SIZE = 512;
export const TEXTURE_SIZE = 512;
export const DIGITS = 10;
export const INPUT_SURFACE_RADIUS = 0.52;

const WORLD_UP = new THREE.Vector3(0, 1, 0);

const BASE_CAMERA: CameraConfig = {
  position: { x: 2.55, y: 2.05, z: 7.1 },
  target: { x: 0, y: -0.04, z: -0.16 },
  fov: 43,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toVector(point: CameraConfig["position"]) {
  return new THREE.Vector3(point.x, point.y, point.z);
}

function toPoint(vector: THREE.Vector3) {
  return {
    x: Number(vector.x.toFixed(3)),
    y: Number(vector.y.toFixed(3)),
    z: Number(vector.z.toFixed(3)),
  };
}

function panCamera(config: CameraConfig, rightPan: number, upPan: number) {
  const basePosition = toVector(config.position);
  const baseTarget = toVector(config.target);
  const viewDirection = baseTarget.clone().sub(basePosition).normalize();
  const cameraRight = viewDirection.clone().cross(WORLD_UP).normalize();
  const cameraUp = cameraRight.clone().cross(viewDirection).normalize();
  const framingPan = cameraRight
    .multiplyScalar(rightPan)
    .add(cameraUp.multiplyScalar(upPan));

  return {
    position: toPoint(basePosition.add(framingPan)),
    target: toPoint(baseTarget.add(framingPan)),
    fov: config.fov,
  };
}

export const DEFAULT_CAMERA: CameraConfig = panCamera(BASE_CAMERA, 0, -0.52);

export function getResponsiveCamera(width: number, height: number) {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const aspect = safeWidth / safeHeight;
  const narrowness = clamp((0.96 - aspect) / 0.54, 0, 1);
  const shortness = clamp((620 - safeHeight) / 300, 0, 1);
  const fov = DEFAULT_CAMERA.fov + narrowness * 8 + shortness * 4;
  const camera = panCamera(
    DEFAULT_CAMERA,
    -0.54 * narrowness,
    -0.16 * shortness,
  );

  return {
    position: camera.position,
    target: camera.target,
    fov: Number(fov.toFixed(2)),
  };
}

export const OPTICAL_AXIS = new THREE.Vector3(0, 0, -1).normalize();
export const SURFACE_ROTATION = new THREE.Quaternion().setFromUnitVectors(
  new THREE.Vector3(0, 0, 1),
  OPTICAL_AXIS.clone().negate(),
);
export const OUTPUT_ROTATION = new THREE.Quaternion().setFromUnitVectors(
  new THREE.Vector3(0, 0, 1),
  OPTICAL_AXIS.clone().negate(),
);
export const SURFACE_STOPS = [-2.45, -1.32, -0.44, 0.42, 1.22, 2.45];
export const LENS_STOPS = SURFACE_STOPS.slice(1, 5);

export const DIGIT_ANCHORS = Array.from({ length: DIGITS }, (_, index) => {
  const angle = -Math.PI / 2 + (index / DIGITS) * Math.PI * 2;
  return {
    x: 0.5 + Math.cos(angle) * 0.31,
    y: 0.5 + Math.sin(angle) * 0.31,
  };
});
