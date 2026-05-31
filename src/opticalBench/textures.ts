import { DIGIT_ANCHORS, DIGITS } from "./constants";
import { circleMask } from "./canvas";
import type { InputLightSample, Point } from "./types";

export function resetInputCanvas(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

export function drawInputStroke(
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
  ctx.strokeStyle = "rgba(8, 18, 22, 0.86)";
  ctx.shadowColor = "rgba(42, 68, 74, 0.22)";
  ctx.shadowBlur = 10;
  ctx.lineWidth = 38;
  ctx.beginPath();
  ctx.moveTo(from?.x ?? to.x, from?.y ?? to.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();
}

function strongestDigit(confidence: number[]) {
  let index = 0;
  let value = 0;
  for (let i = 0; i < confidence.length; i += 1) {
    if (confidence[i] <= value) continue;
    index = i;
    value = confidence[i];
  }
  return { index, value };
}

function confidenceDigitFill(strength: number) {
  const lift = Math.pow(Math.max(0, Math.min(1, strength)), 0.55);
  const value = Math.round(114 - lift * 106);
  return `rgb(${value}, ${value}, ${value})`;
}

function outputDisplayStrength(confidence: number[], strength: number) {
  const maxConfidence = Math.max(...confidence);
  if (maxConfidence <= 0.0005 || strength <= 0.0005) return 0;
  const contrastStretched = strength / Math.max(maxConfidence, 0.34);
  return Math.min(1, Math.pow(contrastStretched, 0.72));
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function normalizedGridSize(input: Float32Array | null) {
  if (!input) return 0;
  const size = Math.sqrt(input.length);
  return Number.isInteger(size) ? size : 0;
}

function cellGeometry(canvasSize: number, gridSize: number, fieldScale = 0.78) {
  const fieldSize = canvasSize * fieldScale;
  const cellSize = fieldSize / gridSize;
  const origin = (canvasSize - fieldSize) / 2;

  return { cellSize, fieldSize, origin };
}

function reliefModulation(nx: number, ny: number, layer = 0) {
  const ring = Math.hypot(nx - 0.5, ny - 0.5);
  return clamp01(
    0.74 +
      Math.sin((nx * 13.7 + ny * 5.1 + layer * 0.9) * Math.PI) * 0.12 +
      Math.cos((ring * 21.5 - layer * 0.6) * Math.PI) * 0.14,
  );
}

function drawSurfaceInterference(
  ctx: CanvasRenderingContext2D,
  size: number,
  layer: number,
  alpha = 1,
) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineWidth = 0.75;
  for (let i = 0; i < 18; i += 1) {
    const radius = size * (0.1 + i * 0.018);
    const start = layer * 0.42 + i * 0.31;
    ctx.beginPath();
    for (let t = 0; t <= Math.PI * 1.22; t += 0.045) {
      const angle = start + t;
      const wobble =
        Math.sin(angle * (3.3 + layer * 0.2)) * size * 0.004 +
        Math.cos(angle * 6.1 - layer) * size * 0.002;
      const x = size / 2 + Math.cos(angle) * (radius + wobble);
      const y = size / 2 + Math.sin(angle) * (radius + wobble);
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.035 * alpha + (i % 3) * 0.012 * alpha})`;
    ctx.stroke();
  }
  ctx.restore();
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  strength: number,
  layer: number,
  mode: "mask" | "light" = "light",
) {
  const nx = x / ctx.canvas.width;
  const ny = y / ctx.canvas.height;
  const relief = reliefModulation(nx, ny, layer);
  const alpha = clamp01(Math.pow(strength, 0.54) * (0.54 + relief * 0.72));

  if (mode === "mask") {
    ctx.fillStyle = `rgba(3, 14, 18, ${Math.min(0.92, alpha * 0.9)})`;
    ctx.fillRect(x, y, size, size);
    if (strength < 0.34) return;
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.16, strength * 0.08 * relief)})`;
    ctx.fillRect(x + size * 0.16, y + size * 0.14, size * 0.36, size * 0.18);
    return;
  }

  ctx.fillStyle = `rgba(8, 14, 16, ${Math.min(0.3, alpha * 0.24)})`;
  ctx.fillRect(x, y, size, size);

  ctx.fillStyle = `rgba(255, 255, 250, ${Math.min(0.9, alpha * 0.82)})`;
  ctx.fillRect(x + size * 0.08, y + size * 0.08, size * 0.84, size * 0.84);

  if (strength < 0.34) return;
  ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.72, strength * 0.46 * relief)})`;
  ctx.fillRect(x + size * 0.16, y + size * 0.14, size * 0.36, size * 0.18);
}

function drawReliefRevealedCells(
  ctx: CanvasRenderingContext2D,
  input: Float32Array,
  layer: number,
  fieldScale = 0.78,
  shift = 0,
  mode: "mask" | "light" = "light",
) {
  const size = ctx.canvas.width;
  const gridSize = normalizedGridSize(input);
  if (!gridSize) return;
  const { cellSize, origin } = cellGeometry(size, gridSize, fieldScale);

  ctx.save();
  ctx.globalCompositeOperation = mode === "mask" ? "source-over" : "lighter";
  for (let gy = 0; gy < gridSize; gy += 1) {
    for (let gx = 0; gx < gridSize; gx += 1) {
      const strength = input[gy * gridSize + gx];
      if (strength < 0.035) continue;
      const nx = (gx + 0.5) / gridSize;
      const ny = (gy + 0.5) / gridSize;
      const phase =
        Math.sin((nx * 8.5 + layer) * Math.PI) +
        Math.cos((ny * 7.2 - layer * 0.6) * Math.PI);
      const x =
        origin + gx * cellSize + Math.cos(phase) * size * shift;
      const y =
        origin + gy * cellSize + Math.sin(phase) * size * shift;
      drawCell(ctx, x, y, cellSize, strength, layer, mode);
    }
  }
  ctx.restore();
}

export function sampleInputLight(input: Float32Array | null) {
  const samples: InputLightSample[] = [];
  const gridSize = normalizedGridSize(input);
  if (!input || !gridSize) return samples;

  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      const alpha = input[y * gridSize + x];
      if (alpha < 0.06) continue;
      const nx = (x + 0.5) / gridSize;
      const ny = (y + 0.5) / gridSize;
      samples.push({
        x: nx,
        y: ny,
        nx,
        ny,
        alpha,
      });
    }
  }

  return samples;
}

export function sampleInputMask(canvas: HTMLCanvasElement, gridSize = 28) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const input = new Float32Array(gridSize * gridSize);
  const cellWidth = canvas.width / gridSize;
  const cellHeight = canvas.height / gridSize;

  for (let gy = 0; gy < gridSize; gy += 1) {
    for (let gx = 0; gx < gridSize; gx += 1) {
      let total = 0;
      let count = 0;
      const startX = Math.floor(gx * cellWidth);
      const endX = Math.ceil((gx + 1) * cellWidth);
      const startY = Math.floor(gy * cellHeight);
      const endY = Math.ceil((gy + 1) * cellHeight);

      for (let y = startY; y < endY; y += 2) {
        for (let x = startX; x < endX; x += 2) {
          total += image[(y * canvas.width + x) * 4 + 3] / 255;
          count += 1;
        }
      }

      input[gy * gridSize + gx] = count > 0 ? total / count : 0;
    }
  }

  return input;
}

export function drawInputSurfaceTexture(
  canvas: HTMLCanvasElement,
  normalizedInput: Float32Array | null,
  hasInk: boolean,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const size = canvas.width;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  circleMask(ctx, size);

  const glass = ctx.createRadialGradient(
    size * 0.38,
    size * 0.3,
    size * 0.05,
    size / 2,
    size / 2,
    size * 0.5,
  );
  glass.addColorStop(0, "rgba(255, 255, 255, 0.3)");
  glass.addColorStop(0.58, "rgba(228, 235, 236, 0.1)");
  glass.addColorStop(1, "rgba(112, 126, 130, 0.04)");
  ctx.fillStyle = glass;
  ctx.fillRect(0, 0, size, size);

  if (hasInk && normalizedInput) {
    drawReliefRevealedCells(ctx, normalizedInput, 0, 0.78, 0, "mask");
    drawSurfaceInterference(ctx, size, 0, 1.45);
  } else {
    const idle = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size * 0.42,
    );
    idle.addColorStop(0, "rgba(255, 255, 255, 0.08)");
    idle.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = idle;
    ctx.fillRect(0, 0, size, size);
  }

  ctx.restore();
}

export function drawLensBaseTexture(canvas: HTMLCanvasElement, layer: number) {
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
  base.addColorStop(0, "rgba(255, 255, 255, 0.34)");
  base.addColorStop(0.55, "rgba(226, 232, 234, 0.13)");
  base.addColorStop(1, "rgba(116, 128, 132, 0.045)");
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
    ctx.strokeStyle = `rgba(58, 72, 76, ${alpha})`;
    ctx.stroke();
  }

  ctx.restore();
}

function drawCircuitLikeLightField(
  ctx: CanvasRenderingContext2D,
  samples: InputLightSample[],
  layer: number,
) {
  const size = ctx.canvas.width;
  const gridSize = 40;
  const { cellSize, origin } = cellGeometry(size, gridSize, 0.8);

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.lineCap = "square";
  ctx.lineJoin = "bevel";

  for (const sample of samples) {
    if (sample.alpha < 0.075) continue;

    const sourceX = origin + sample.nx * cellSize * gridSize;
    const sourceY = origin + sample.ny * cellSize * gridSize;
    const phase =
      Math.sin((sample.nx * 9.4 + layer * 0.7) * Math.PI) +
      Math.cos((sample.ny * 8.1 - layer * 0.5) * Math.PI);

    for (let branch = 0; branch < 2; branch += 1) {
      const branchPhase = phase + branch * 1.7;
      const length = cellSize * (1.8 + sample.alpha * 4.5);
      const midX = sourceX + Math.cos(branchPhase) * length * 0.6;
      const midY = sourceY + Math.sin(branchPhase * 0.8) * length * 0.6;
      const endX =
        sourceX +
        Math.cos(branchPhase + layer * 0.35) * length +
        Math.sin(sample.ny * Math.PI * 4) * cellSize * 0.7;
      const endY =
        sourceY +
        Math.sin(branchPhase - layer * 0.25) * length +
        Math.cos(sample.nx * Math.PI * 5) * cellSize * 0.7;

      ctx.strokeStyle = `rgba(8, 14, 16, ${0.05 + sample.alpha * 0.12})`;
      ctx.lineWidth = Math.max(1.5, cellSize * (0.16 + sample.alpha * 0.2));
      ctx.beginPath();
      ctx.moveTo(sourceX, sourceY);
      ctx.quadraticCurveTo(midX, midY, endX, endY);
      ctx.stroke();

      ctx.strokeStyle = `rgba(255, 255, 255, ${0.22 + sample.alpha * 0.34})`;
      ctx.lineWidth = Math.max(0.8, cellSize * (0.08 + sample.alpha * 0.1));
      ctx.beginPath();
      ctx.moveTo(sourceX, sourceY);
      ctx.quadraticCurveTo(midX, midY, endX, endY);
      ctx.stroke();

      const gx = Math.max(
        0,
        Math.min(gridSize - 1, Math.round((endX - origin) / cellSize)),
      );
      const gy = Math.max(
        0,
        Math.min(gridSize - 1, Math.round((endY - origin) / cellSize)),
      );
      drawCell(
        ctx,
        origin + gx * cellSize,
        origin + gy * cellSize,
        cellSize,
        sample.alpha * 0.8,
        layer,
      );
    }
  }

  ctx.restore();
}

function drawFeatureBundleLightField(
  ctx: CanvasRenderingContext2D,
  samples: InputLightSample[],
  confidence: number[],
  layer: number,
) {
  const size = ctx.canvas.width;
  const gridSize = 24;
  const { cellSize, origin } = cellGeometry(size, gridSize, 0.72);
  const { index: winner, value: winnerStrength } = strongestDigit(confidence);
  const focus = DIGIT_ANCHORS[winner] ?? { x: 0.5, y: 0.5 };

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  for (const sample of samples) {
    if (sample.alpha < 0.06) continue;
    const featurePull = 0.28 + winnerStrength * 0.18;
    const localPhase =
      Math.sin(sample.nx * Math.PI * 5 + layer) *
      Math.cos(sample.ny * Math.PI * 4 - layer * 0.5);
    const nx =
      sample.nx +
      (focus.x - sample.nx) * featurePull +
      Math.cos(localPhase * Math.PI) * 0.045;
    const ny =
      sample.ny +
      (focus.y - sample.ny) * featurePull +
      Math.sin(localPhase * Math.PI) * 0.045;
    const gx = Math.max(0, Math.min(gridSize - 1, Math.round(nx * gridSize)));
    const gy = Math.max(0, Math.min(gridSize - 1, Math.round(ny * gridSize)));
    drawCell(
      ctx,
      origin + gx * cellSize,
      origin + gy * cellSize,
      cellSize,
      sample.alpha * (0.72 + winnerStrength * 0.3),
      layer,
    );
  }

  ctx.strokeStyle = "rgba(8, 14, 16, 0.14)";
  ctx.lineWidth = 2.8;
  for (let arc = 0; arc < 7; arc += 1) {
    const radius = size * (0.11 + arc * 0.034);
    ctx.beginPath();
    ctx.arc(
      size * (0.5 + (focus.x - 0.5) * 0.34),
      size * (0.5 + (focus.y - 0.5) * 0.34),
      radius,
      layer * 0.42 + arc * 0.31,
      layer * 0.42 + arc * 0.31 + Math.PI * 0.58,
    );
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255, 255, 255, 0.38)";
  ctx.lineWidth = 1.35;
  for (let arc = 0; arc < 7; arc += 1) {
    const radius = size * (0.11 + arc * 0.034);
    ctx.beginPath();
    ctx.arc(
      size * (0.5 + (focus.x - 0.5) * 0.34),
      size * (0.5 + (focus.y - 0.5) * 0.34),
      radius,
      layer * 0.42 + arc * 0.31,
      layer * 0.42 + arc * 0.31 + Math.PI * 0.58,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawCandidateSplittingLightField(
  ctx: CanvasRenderingContext2D,
  confidence: number[],
  layer: number,
) {
  const size = ctx.canvas.width;
  const centerX = size / 2;
  const centerY = size / 2;

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  confidence.forEach((strength, digit) => {
    const displayStrength = outputDisplayStrength(confidence, strength);
    if (displayStrength < 0.02) return;

    const anchor = DIGIT_ANCHORS[digit];
    const x = size * (0.5 + (anchor.x - 0.5) * 0.72);
    const y = size * (0.5 + (anchor.y - 0.5) * 0.72);
    const alpha = 0.05 + displayStrength * 0.28;
    const radius = size * (0.045 + displayStrength * 0.065);

    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 3.6);
    glow.addColorStop(0, `rgba(255, 255, 255, ${alpha * 1.15})`);
    glow.addColorStop(0.48, `rgba(245, 245, 238, ${alpha * 0.72})`);
    glow.addColorStop(1, "rgba(245, 245, 238, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);

    for (let trace = 0; trace < 2; trace += 1) {
      const bend = digit * 0.37 + trace * 0.9 + layer;
      ctx.strokeStyle = `rgba(8, 14, 16, ${0.06 + displayStrength * 0.15})`;
      ctx.lineWidth = 1.6 + displayStrength * 1.4;
      ctx.beginPath();
      ctx.moveTo(
        centerX + Math.cos(bend) * size * 0.06,
        centerY + Math.sin(bend) * size * 0.06,
      );
      ctx.quadraticCurveTo(
        size * (0.5 + Math.cos(bend + 0.8) * 0.12),
        size * (0.5 + Math.sin(bend + 0.8) * 0.12),
        x,
        y,
      );
      ctx.stroke();
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.18 + displayStrength * 0.28})`;
      ctx.lineWidth = 0.85 + displayStrength * 0.8;
      ctx.beginPath();
      ctx.moveTo(
        centerX + Math.cos(bend) * size * 0.06,
        centerY + Math.sin(bend) * size * 0.06,
      );
      ctx.quadraticCurveTo(
        size * (0.5 + Math.cos(bend + 0.8) * 0.12),
        size * (0.5 + Math.sin(bend + 0.8) * 0.12),
        x,
        y,
      );
      ctx.stroke();
    }
  });
  ctx.restore();
}

function drawIdleLight(ctx: CanvasRenderingContext2D, size: number) {
  const idle = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size * 0.42,
  );
  idle.addColorStop(0, "rgba(255, 255, 255, 0.07)");
  idle.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = idle;
  ctx.fillRect(0, 0, size, size);
}

export function drawLensTexture(
  canvas: HTMLCanvasElement,
  baseCanvas: HTMLCanvasElement,
  inputLightSamples: InputLightSample[],
  confidence: number[],
  layer: number,
  hasInk: boolean,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const size = canvas.width;
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(baseCanvas, 0, 0);
  ctx.save();
  circleMask(ctx, size);

  if (hasInk) {
    if (layer === 1 && inputLightSamples.length > 0) {
      const gridSize = 28;
      const input = new Float32Array(gridSize * gridSize);
      for (const sample of inputLightSamples) {
        const x = Math.floor(sample.nx * gridSize);
        const y = Math.floor(sample.ny * gridSize);
        input[y * gridSize + x] = sample.alpha;
      }
      drawReliefRevealedCells(ctx, input, layer, 0.78, 0.0025, "mask");
    } else if (layer === 2) {
      drawCircuitLikeLightField(ctx, inputLightSamples, layer);
    } else if (layer === 3) {
      drawFeatureBundleLightField(ctx, inputLightSamples, confidence, layer);
    } else {
      drawCandidateSplittingLightField(ctx, confidence, layer);
    }

    drawSurfaceInterference(ctx, size, layer, 1.2);
  } else {
    drawIdleLight(ctx, size);
  }

  ctx.restore();
}

export function drawOutputTexture(
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

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "650 50px Inter, ui-sans-serif, system-ui";

  for (let digit = 0; digit < DIGITS; digit += 1) {
    const anchor = DIGIT_ANCHORS[digit];
    const x = anchor.x * size;
    const y = anchor.y * size;
    const strength = hasInk ? confidence[digit] : 0;
    const displayStrength = hasInk
      ? outputDisplayStrength(confidence, strength)
      : 0;
    ctx.lineWidth = hasInk ? 2.4 + displayStrength * 1.5 : 1.8;
    ctx.strokeStyle = hasInk
      ? `rgba(8, 12, 14, ${0.18 + displayStrength * 0.7})`
      : "rgba(36, 52, 56, 0.18)";
    ctx.strokeText(String(digit), x, y);
    ctx.fillStyle = hasInk
      ? confidenceDigitFill(displayStrength)
      : "rgba(36, 52, 56, 0.68)";
    ctx.fillText(String(digit), x, y);
  }

  ctx.strokeStyle = "rgba(88, 120, 128, 0.12)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.45, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
