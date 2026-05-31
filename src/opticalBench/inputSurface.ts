import * as THREE from "three";
import { INPUT_SIZE, INPUT_SURFACE_RADIUS } from "./constants";
import type { Point, SceneState } from "./types";

export function pointOnInput(
  event: PointerEvent | MouseEvent,
  container: HTMLDivElement,
  state: SceneState,
): Point | null {
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

export function hitsInputSurface(
  event: PointerEvent | MouseEvent,
  container: HTMLDivElement,
  state: SceneState,
) {
  if (pointOnInput(event, container, state)) return true;

  const rect = container.getBoundingClientRect();
  const center = state.inputMesh.position.clone().project(state.camera);
  const edgeX = new THREE.Vector3(INPUT_SURFACE_RADIUS, 0, 0)
    .applyQuaternion(state.inputMesh.quaternion)
    .add(state.inputMesh.position)
    .project(state.camera);
  const edgeY = new THREE.Vector3(0, INPUT_SURFACE_RADIUS, 0)
    .applyQuaternion(state.inputMesh.quaternion)
    .add(state.inputMesh.position)
    .project(state.camera);

  const centerX = ((center.x + 1) / 2) * rect.width;
  const centerY = ((1 - center.y) / 2) * rect.height;
  const edgeScreenX = ((edgeX.x + 1) / 2) * rect.width;
  const edgeScreenY = ((1 - edgeX.y) / 2) * rect.height;
  const edgeScreenX2 = ((edgeY.x + 1) / 2) * rect.width;
  const edgeScreenY2 = ((1 - edgeY.y) / 2) * rect.height;
  const radius = Math.max(
    Math.hypot(edgeScreenX - centerX, edgeScreenY - centerY),
    Math.hypot(edgeScreenX2 - centerX, edgeScreenY2 - centerY),
  );
  const pointerX = event.clientX - rect.left;
  const pointerY = event.clientY - rect.top;

  return Math.hypot(pointerX - centerX, pointerY - centerY) <= radius * 1.12;
}
