import * as THREE from "three";
import type { CameraConfig, Point } from "./types";

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const ORBIT_SPEED = 0.006;
const PINCH_SPEED = 0.012;

export type HiddenDebugTapState = {
  count: number;
  firstTapAt: number;
};

export type HiddenDebugTapConfig = {
  limit: number;
  zone: number;
  windowMs: number;
};

export const DEFAULT_HIDDEN_DEBUG_TAP_CONFIG: HiddenDebugTapConfig = {
  limit: 5,
  zone: 64,
  windowMs: 3000,
};

function roundCameraValue(value: number) {
  return Number(value.toFixed(3));
}

function vectorFromPoint(point: CameraConfig["position"]) {
  return new THREE.Vector3(point.x, point.y, point.z);
}

function pointFromVector(vector: THREE.Vector3) {
  return {
    x: roundCameraValue(vector.x),
    y: roundCameraValue(vector.y),
    z: roundCameraValue(vector.z),
  };
}

export function pointerPoint(event: PointerEvent): Point {
  return { x: event.clientX, y: event.clientY };
}

export function distanceBetween(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function midpoint(a: Point, b: Point) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function cameraBasis(config: CameraConfig) {
  const position = vectorFromPoint(config.position);
  const target = vectorFromPoint(config.target);
  const viewDirection = target.clone().sub(position).normalize();
  const right = viewDirection.clone().cross(WORLD_UP).normalize();
  const up = right.clone().cross(viewDirection).normalize();
  const distance = position.distanceTo(target);

  return { position, target, right, up, viewDirection, distance };
}

export function orbitCamera(config: CameraConfig, dx: number, dy: number) {
  const target = vectorFromPoint(config.target);
  const offset = vectorFromPoint(config.position).sub(target);
  const spherical = new THREE.Spherical().setFromVector3(offset);
  spherical.theta -= dx * ORBIT_SPEED;
  spherical.phi = THREE.MathUtils.clamp(
    spherical.phi - dy * ORBIT_SPEED,
    0.12,
    Math.PI - 0.12,
  );
  offset.setFromSpherical(spherical);

  return {
    ...config,
    position: pointFromVector(target.clone().add(offset)),
  };
}

export function panCamera(
  config: CameraConfig,
  dx: number,
  dy: number,
  height: number,
) {
  const { position, target, right, up, distance } = cameraBasis(config);
  const worldUnitsPerPixel =
    (2 * Math.tan(THREE.MathUtils.degToRad(config.fov) / 2) * distance) /
    Math.max(1, height);
  const shift = right
    .multiplyScalar(-dx * worldUnitsPerPixel)
    .add(up.multiplyScalar(dy * worldUnitsPerPixel));

  return {
    ...config,
    position: pointFromVector(position.add(shift)),
    target: pointFromVector(target.add(shift)),
  };
}

export function dollyCamera(config: CameraConfig, delta: number) {
  const { target, viewDirection, distance } = cameraBasis(config);
  const nextDistance = THREE.MathUtils.clamp(
    distance * Math.exp(delta * PINCH_SPEED),
    1.2,
    16,
  );
  const nextPosition = target
    .clone()
    .sub(viewDirection.multiplyScalar(nextDistance));

  return {
    ...config,
    position: pointFromVector(nextPosition),
  };
}

export function updateHiddenDebugTap(
  state: HiddenDebugTapState,
  point: Point,
  now: number,
  config = DEFAULT_HIDDEN_DEBUG_TAP_CONFIG,
) {
  if (point.x > config.zone || point.y > config.zone) {
    return { state, shouldToggle: false };
  }

  const withinWindow =
    state.firstTapAt > 0 && now - state.firstTapAt <= config.windowMs;
  const nextState = withinWindow
    ? { ...state, count: state.count + 1 }
    : { count: 1, firstTapAt: now };

  if (nextState.count < config.limit) {
    return { state: nextState, shouldToggle: false };
  }

  return {
    state: { count: 0, firstTapAt: 0 },
    shouldToggle: true,
  };
}
