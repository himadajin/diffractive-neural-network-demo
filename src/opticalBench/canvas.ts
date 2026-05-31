import { TEXTURE_SIZE } from "./constants";

export function createCanvas(size = TEXTURE_SIZE) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

export function circleMask(ctx: CanvasRenderingContext2D, size: number) {
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.48, 0, Math.PI * 2);
  ctx.clip();
}
