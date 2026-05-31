import * as THREE from "three";
import type { CameraConfig } from "./types";

export const INPUT_SIZE = 512;
export const TEXTURE_SIZE = 512;
export const DIGITS = 10;
export const INPUT_SURFACE_RADIUS = 0.52;

export const DEFAULT_CAMERA: CameraConfig = {
  position: { x: 2.55, y: 2.05, z: 7.1 },
  target: { x: 0, y: -0.04, z: -0.16 },
  fov: 43,
};

export const PORTRAIT_CAMERA: CameraConfig = {
  position: { x: 1.35, y: 2.95, z: 7.8 },
  target: { x: 0, y: -0.08, z: -0.12 },
  fov: 50,
};

export const COMPACT_LANDSCAPE_CAMERA: CameraConfig = {
  position: { x: 2.8, y: 1.35, z: 7.35 },
  target: { x: 0, y: -0.12, z: -0.18 },
  fov: 49,
};

export function getResponsiveCamera(width: number, height: number) {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const aspect = safeWidth / safeHeight;

  if (aspect < 0.82) return PORTRAIT_CAMERA;
  if (safeHeight < 560) return COMPACT_LANDSCAPE_CAMERA;
  return DEFAULT_CAMERA;
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
