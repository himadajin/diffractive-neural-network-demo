import { INPUT_SIZE } from "./constants";
import type { Point, SceneState } from "./types";

export function pointOnInput(
  event: PointerEvent,
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
