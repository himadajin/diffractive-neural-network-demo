import * as THREE from "three";
import type { CameraConfig } from "./types";

export const INPUT_SIZE = 512;
export const TEXTURE_SIZE = 512;
export const DIGITS = 10;

export const DEFAULT_CAMERA: CameraConfig = {
  position: { x: -3.2, y: 1.22, z: 6.55 },
  target: { x: 0.22, y: -0.02, z: -0.08 },
  fov: 54,
};

export const OPTICAL_AXIS = new THREE.Vector3(1, 0, -0.14).normalize();
export const SURFACE_ROTATION = new THREE.Quaternion().setFromUnitVectors(
  new THREE.Vector3(0, 0, 1),
  OPTICAL_AXIS,
);
export const OUTPUT_ROTATION = new THREE.Quaternion().setFromUnitVectors(
  new THREE.Vector3(0, 0, 1),
  OPTICAL_AXIS.clone().negate(),
);
export const SURFACE_STOPS = [-2.65, -1.28, -0.42, 0.44, 1.3, 2.65];
export const LENS_STOPS = SURFACE_STOPS.slice(1, 5);

export const DIGIT_ANCHORS = Array.from({ length: DIGITS }, (_, index) => {
  const angle = -Math.PI / 2 + (index / DIGITS) * Math.PI * 2;
  return {
    x: 0.5 + Math.cos(angle) * 0.31,
    y: 0.5 + Math.sin(angle) * 0.31,
  };
});
