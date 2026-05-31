import { DIGIT_ANCHORS, DIGITS } from "./constants";
import { circleMask } from "./canvas";
import type { InputLightSample, Point } from "./types";

const CELL_FIELD_GRID_SIZE = 28;
const CELL_FIELD_SCALE = 0.78;

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
  ctx.strokeStyle = "rgba(8, 18, 22, 1)";
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

function cellIndex(x: number, y: number) {
  return y * CELL_FIELD_GRID_SIZE + x;
}

function addFieldEnergy(
  field: Float32Array,
  x: number,
  y: number,
  strength: number,
) {
  if (
    x < 0 ||
    x >= CELL_FIELD_GRID_SIZE ||
    y < 0 ||
    y >= CELL_FIELD_GRID_SIZE
  ) {
    return;
  }

  const index = cellIndex(x, y);
  const amount = clamp01(strength);
  field[index] = 1 - (1 - field[index]) * (1 - amount);
}

function addFieldCluster(
  field: Float32Array,
  x: number,
  y: number,
  strength: number,
  spread = 0,
) {
  const gx = Math.round(x);
  const gy = Math.round(y);
  addFieldEnergy(field, gx, gy, strength);
  if (spread <= 0) return;

  addFieldEnergy(field, gx - 1, gy, strength * spread * 0.56);
  addFieldEnergy(field, gx + 1, gy, strength * spread * 0.56);
  addFieldEnergy(field, gx, gy - 1, strength * spread * 0.56);
  addFieldEnergy(field, gx, gy + 1, strength * spread * 0.56);
  addFieldEnergy(field, gx - 1, gy - 1, strength * spread * 0.24);
  addFieldEnergy(field, gx + 1, gy - 1, strength * spread * 0.24);
  addFieldEnergy(field, gx - 1, gy + 1, strength * spread * 0.24);
  addFieldEnergy(field, gx + 1, gy + 1, strength * spread * 0.24);
}

function normalizeFieldPeak(field: Float32Array) {
  let max = 0;
  for (const strength of field) {
    max = Math.max(max, strength);
  }
  if (max <= 0.0005) return field;

  for (let i = 0; i < field.length; i += 1) {
    field[i] = clamp01(field[i] / max);
  }
  return field;
}

function fieldFromSamples(samples: InputLightSample[]) {
  const field = new Float32Array(CELL_FIELD_GRID_SIZE * CELL_FIELD_GRID_SIZE);
  for (const sample of samples) {
    if (sample.alpha < 0.008) continue;
    const gx = Math.min(
      CELL_FIELD_GRID_SIZE - 1,
      Math.max(0, Math.floor(sample.nx * CELL_FIELD_GRID_SIZE)),
    );
    const gy = Math.min(
      CELL_FIELD_GRID_SIZE - 1,
      Math.max(0, Math.floor(sample.ny * CELL_FIELD_GRID_SIZE)),
    );
    addFieldCluster(field, gx, gy, sample.alpha, 0.18);
  }
  return normalizeFieldPeak(field);
}

function fixedCircuitVector(gx: number, gy: number, layer: number) {
  const nx = (gx + 0.5) / CELL_FIELD_GRID_SIZE;
  const ny = (gy + 0.5) / CELL_FIELD_GRID_SIZE;
  const ring = Math.hypot(nx - 0.5, ny - 0.5);
  const phase =
    Math.sin((nx * 7.7 + layer * 0.48) * Math.PI) +
    Math.cos((ny * 6.1 - layer * 0.34) * Math.PI) +
    ring * Math.PI * (2.4 + layer * 0.18);

  return {
    x: Math.cos(phase),
    y: Math.sin(phase * 0.86 + layer * 0.32),
  };
}

function buildFirstLensField(samples: InputLightSample[], layer: number) {
  const source = fieldFromSamples(samples);
  const output = new Float32Array(source.length);

  for (let gy = 0; gy < CELL_FIELD_GRID_SIZE; gy += 1) {
    for (let gx = 0; gx < CELL_FIELD_GRID_SIZE; gx += 1) {
      const strength = source[cellIndex(gx, gy)];
      if (strength < 0.025) continue;

      const circuit = fixedCircuitVector(gx, gy, layer);
      addFieldCluster(output, gx, gy, strength * 0.82, 0.16);
      addFieldCluster(
        output,
        gx + circuit.x * 0.85,
        gy + circuit.y * 0.85,
        strength * 0.4,
        0.1,
      );
    }
  }

  return normalizeFieldPeak(output);
}

function buildCircuitField(samples: InputLightSample[], layer: number) {
  const source = fieldFromSamples(samples);
  const output = new Float32Array(source.length);

  for (let gy = 0; gy < CELL_FIELD_GRID_SIZE; gy += 1) {
    for (let gx = 0; gx < CELL_FIELD_GRID_SIZE; gx += 1) {
      const strength = source[cellIndex(gx, gy)];
      if (strength < 0.025) continue;

      const circuit = fixedCircuitVector(gx, gy, layer);
      addFieldCluster(
        output,
        gx + circuit.x * 1.7,
        gy + circuit.y * 1.7,
        strength * 0.72,
        0.18,
      );
      addFieldCluster(
        output,
        gx - circuit.y * 1.15,
        gy + circuit.x * 1.15,
        strength * 0.36,
        0.12,
      );
      addFieldCluster(output, gx, gy, strength * 0.14, 0);
    }
  }

  return normalizeFieldPeak(output);
}

function buildFeatureBundleField(
  samples: InputLightSample[],
  confidence: number[],
  layer: number,
) {
  const source = buildCircuitField(samples, layer);
  const output = new Float32Array(source.length);
  const { index: winner, value: winnerStrength } = strongestDigit(confidence);
  const focus =
    winnerStrength > 0.01
      ? (DIGIT_ANCHORS[winner] ?? { x: 0.5, y: 0.5 })
      : null;
  const focusX = (focus?.x ?? 0.5) * (CELL_FIELD_GRID_SIZE - 1);
  const focusY = (focus?.y ?? 0.5) * (CELL_FIELD_GRID_SIZE - 1);

  for (let gy = 0; gy < CELL_FIELD_GRID_SIZE; gy += 1) {
    for (let gx = 0; gx < CELL_FIELD_GRID_SIZE; gx += 1) {
      const strength = source[cellIndex(gx, gy)];
      if (strength < 0.025) continue;

      const circuit = fixedCircuitVector(gx, gy, layer);
      const pull = 0.18 + winnerStrength * 0.22;
      addFieldCluster(
        output,
        gx + (focusX - gx) * pull + circuit.x * 0.75,
        gy + (focusY - gy) * pull + circuit.y * 0.75,
        strength * (0.76 + winnerStrength * 0.22),
        0.3,
      );
    }
  }

  return normalizeFieldPeak(output);
}

function buildCandidateField(
  samples: InputLightSample[],
  confidence: number[],
  layer: number,
) {
  const source = buildFeatureBundleField(samples, confidence, layer);
  const output = new Float32Array(source.length);

  confidence.forEach((strength, digit) => {
    const displayStrength = outputDisplayStrength(confidence, strength);
    if (displayStrength < 0.015) return;

    const anchor = DIGIT_ANCHORS[digit];
    const targetX =
      (0.5 + (anchor.x - 0.5) * 0.74) * (CELL_FIELD_GRID_SIZE - 1);
    const targetY =
      (0.5 + (anchor.y - 0.5) * 0.74) * (CELL_FIELD_GRID_SIZE - 1);

    addFieldCluster(output, targetX, targetY, displayStrength, 0.52);

    for (let gy = 0; gy < CELL_FIELD_GRID_SIZE; gy += 1) {
      for (let gx = 0; gx < CELL_FIELD_GRID_SIZE; gx += 1) {
        const sourceStrength = source[cellIndex(gx, gy)];
        if (sourceStrength < 0.045) continue;
        const circuit = fixedCircuitVector(gx, gy, layer + digit * 0.13);
        const pull = 0.34 + displayStrength * 0.2;
        addFieldCluster(
          output,
          gx + (targetX - gx) * pull + circuit.x * 0.45,
          gy + (targetY - gy) * pull + circuit.y * 0.45,
          sourceStrength * displayStrength * 0.42,
          0.18,
        );
      }
    }
  });

  return normalizeFieldPeak(output);
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

function drawFixedCircuitRelief(
  ctx: CanvasRenderingContext2D,
  size: number,
  layer: number,
  alpha = 1,
) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let track = 0; track < 18; track += 1) {
    const radius = size * (0.09 + track * 0.018);
    const start = layer * 0.36 + track * 0.28;
    const sweep = Math.PI * (0.82 + (track % 4) * 0.16);

    ctx.beginPath();
    for (let t = 0; t <= sweep; t += 0.035) {
      const angle = start + t;
      const groove =
        Math.sin(angle * (2.2 + layer * 0.16) + track) * size * 0.005 +
        Math.cos(angle * 5.4 - layer * 0.7) * size * 0.0025;
      const bend = Math.sin(track * 1.7 + layer) * size * 0.018;
      const x =
        size / 2 +
        Math.cos(angle) * (radius + groove) +
        Math.cos(angle * 0.48) * bend;
      const y =
        size / 2 +
        Math.sin(angle) * (radius + groove) +
        Math.sin(angle * 0.52) * bend;
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.lineWidth = 1.15 + (track % 3) * 0.18;
    ctx.strokeStyle = `rgba(34, 56, 62, ${(0.025 + (track % 3) * 0.01) * alpha})`;
    ctx.stroke();

    ctx.globalCompositeOperation = "screen";
    ctx.lineWidth = 0.62;
    ctx.strokeStyle = `rgba(255, 255, 255, ${(0.055 + (track % 4) * 0.01) * alpha})`;
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

  const lightAlpha = clamp01(Math.pow(strength, 0.48) * (0.72 + relief * 0.42));

  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = `rgba(8, 28, 34, ${Math.min(0.42, lightAlpha * 0.34)})`;
  ctx.fillRect(x + size * 0.06, y + size * 0.08, size * 0.98, size * 0.98);
  ctx.fillStyle = `rgba(112, 160, 168, ${Math.min(0.72, 0.18 + lightAlpha * 0.5)})`;
  ctx.fillRect(x, y, size * 1.01, size * 1.01);
  ctx.fillStyle = `rgba(230, 254, 255, ${Math.min(0.42, lightAlpha * 0.3)})`;
  ctx.fillRect(x, y, size * 1.01, size * 1.01);

  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = `rgba(218, 250, 255, ${Math.min(0.28, lightAlpha * 0.22)})`;
  ctx.fillRect(x, y, size * 1.01, size * 1.01);
  ctx.fillStyle = `rgba(255, 255, 248, ${Math.min(0.38, lightAlpha * 0.24)})`;
  ctx.fillRect(x, y, size * 1.01, size * 1.01);

  if (strength >= 0.34) {
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.48, strength * 0.34 * relief)})`;
    ctx.fillRect(x + size * 0.18, y + size * 0.14, size * 0.42, size * 0.16);
  }

  ctx.globalCompositeOperation = "source-over";
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
      const x = origin + gx * cellSize + Math.cos(phase) * size * shift;
      const y = origin + gy * cellSize + Math.sin(phase) * size * shift;
      drawCell(ctx, x, y, cellSize, strength, layer, mode);
    }
  }
  ctx.restore();
}

function drawLuminousCellField(
  ctx: CanvasRenderingContext2D,
  field: Float32Array,
  layer: number,
) {
  const size = ctx.canvas.width;
  const { cellSize, origin } = cellGeometry(
    size,
    CELL_FIELD_GRID_SIZE,
    CELL_FIELD_SCALE,
  );
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = size;
  glowCanvas.height = size;
  const glowCtx = glowCanvas.getContext("2d");

  if (glowCtx) {
    for (let gy = 0; gy < CELL_FIELD_GRID_SIZE; gy += 1) {
      for (let gx = 0; gx < CELL_FIELD_GRID_SIZE; gx += 1) {
        const strength = field[cellIndex(gx, gy)];
        if (strength < 0.025) continue;
        const alpha = Math.pow(strength, 0.58);
        glowCtx.fillStyle = `rgba(190, 232, 238, ${Math.min(0.42, alpha * 0.32)})`;
        glowCtx.fillRect(
          origin + gx * cellSize,
          origin + gy * cellSize,
          cellSize,
          cellSize,
        );
        glowCtx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.5, alpha * 0.36)})`;
        glowCtx.fillRect(
          origin + gx * cellSize,
          origin + gy * cellSize,
          cellSize,
          cellSize,
        );
      }
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.filter = "blur(8px)";
    ctx.globalAlpha = 0.92;
    ctx.drawImage(glowCanvas, 0, 0);
    ctx.filter = "blur(2.4px)";
    ctx.globalAlpha = 0.68;
    ctx.drawImage(glowCanvas, 0, 0);
    ctx.restore();
  }

  ctx.save();
  for (let gy = 0; gy < CELL_FIELD_GRID_SIZE; gy += 1) {
    for (let gx = 0; gx < CELL_FIELD_GRID_SIZE; gx += 1) {
      const strength = field[cellIndex(gx, gy)];
      if (strength < 0.025) continue;
      drawCell(
        ctx,
        origin + gx * cellSize,
        origin + gy * cellSize,
        cellSize,
        strength,
        layer,
      );
    }
  }
  ctx.restore();
}

function drawSmoothInputMask(
  ctx: CanvasRenderingContext2D,
  inputCanvas: HTMLCanvasElement,
) {
  const size = ctx.canvas.width;
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = size;
  maskCanvas.height = size;
  const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
  if (!maskCtx) return;

  maskCtx.drawImage(inputCanvas, 0, 0, size, size);
  const image = maskCtx.getImageData(0, 0, size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const alpha = image.data[i + 3] / 255;
    const shapedAlpha = clamp01((alpha - 0.06) / 0.18);
    image.data[i] = 0;
    image.data[i + 1] = 0;
    image.data[i + 2] = 0;
    image.data[i + 3] = Math.round(shapedAlpha * shapedAlpha * 255);
  }
  maskCtx.putImageData(image, 0, 0);

  const inkCanvas = document.createElement("canvas");
  inkCanvas.width = size;
  inkCanvas.height = size;
  const inkCtx = inkCanvas.getContext("2d");
  if (!inkCtx) return;
  inkCtx.fillStyle = "rgba(2, 11, 14, 0.9)";
  inkCtx.fillRect(0, 0, size, size);
  inkCtx.globalCompositeOperation = "destination-in";
  inkCtx.drawImage(maskCanvas, 0, 0);

  const edgeCanvas = document.createElement("canvas");
  edgeCanvas.width = size;
  edgeCanvas.height = size;
  const edgeCtx = edgeCanvas.getContext("2d");
  if (!edgeCtx) return;
  edgeCtx.fillStyle = "rgba(190, 236, 240, 0.42)";
  edgeCtx.fillRect(0, 0, size, size);
  edgeCtx.globalCompositeOperation = "destination-in";
  edgeCtx.drawImage(maskCanvas, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = "source-over";

  ctx.filter = "blur(7px)";
  ctx.globalAlpha = 0.22;
  ctx.drawImage(maskCanvas, 0, 0);

  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.drawImage(inkCanvas, 0, 0);

  ctx.globalCompositeOperation = "screen";
  ctx.filter = "blur(1.6px)";
  ctx.globalAlpha = 0.12;
  ctx.drawImage(edgeCanvas, 0, 0);
  ctx.restore();
}

function drawFirstLensTransformation(
  ctx: CanvasRenderingContext2D,
  samples: InputLightSample[],
  layer: number,
) {
  drawLuminousCellField(ctx, buildFirstLensField(samples, layer), layer);
}

export function sampleInputLight(input: Float32Array | null) {
  const samples: InputLightSample[] = [];
  const gridSize = normalizedGridSize(input);
  if (!input || !gridSize) return samples;

  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      const alpha = input[y * gridSize + x];
      if (alpha < 0.012) continue;
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
  inputMaskCanvas?: HTMLCanvasElement | null,
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
    if (inputMaskCanvas) {
      drawSmoothInputMask(ctx, inputMaskCanvas);
    } else {
      drawReliefRevealedCells(ctx, normalizedInput, 0, 0.78, 0, "mask");
    }
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

  const edge = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.38,
    size / 2,
    size / 2,
    size * 0.52,
  );
  edge.addColorStop(0, "rgba(255, 255, 255, 0)");
  edge.addColorStop(0.72, "rgba(255, 255, 255, 0.08)");
  edge.addColorStop(1, "rgba(36, 64, 70, 0.09)");
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, size, size);

  drawFixedCircuitRelief(ctx, size, layer, 1.18);

  ctx.restore();
}

function drawCircuitLikeLightField(
  ctx: CanvasRenderingContext2D,
  samples: InputLightSample[],
  layer: number,
) {
  drawLuminousCellField(ctx, buildCircuitField(samples, layer), layer);
}

function drawFeatureBundleLightField(
  ctx: CanvasRenderingContext2D,
  samples: InputLightSample[],
  confidence: number[],
  layer: number,
) {
  drawLuminousCellField(
    ctx,
    buildFeatureBundleField(samples, confidence, layer),
    layer,
  );
}

function drawCandidateSplittingLightField(
  ctx: CanvasRenderingContext2D,
  samples: InputLightSample[],
  confidence: number[],
  layer: number,
) {
  drawLuminousCellField(
    ctx,
    buildCandidateField(samples, confidence, layer),
    layer,
  );
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
    if (layer === 1) {
      drawFirstLensTransformation(ctx, inputLightSamples, layer);
    } else if (layer === 2) {
      drawCircuitLikeLightField(ctx, inputLightSamples, layer);
    } else if (layer === 3) {
      drawFeatureBundleLightField(ctx, inputLightSamples, confidence, layer);
    } else {
      drawCandidateSplittingLightField(
        ctx,
        inputLightSamples,
        confidence,
        layer,
      );
    }

    drawFixedCircuitRelief(ctx, size, layer, 0.46);
    drawSurfaceInterference(ctx, size, layer, 1.2);
  } else {
    drawIdleLight(ctx, size);
  }

  ctx.restore();
}

function drawOutputConfidenceGlow(
  ctx: CanvasRenderingContext2D,
  size: number,
  confidence: number[],
) {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";

  for (let digit = 0; digit < DIGITS; digit += 1) {
    const displayStrength = outputDisplayStrength(
      confidence,
      confidence[digit],
    );
    if (displayStrength < 0.01) continue;

    const anchor = DIGIT_ANCHORS[digit];
    const x = anchor.x * size;
    const y = anchor.y * size;
    const radius = size * 0.074;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.2);
    glow.addColorStop(
      0,
      `rgba(255, 255, 255, ${0.56 + displayStrength * 0.44})`,
    );
    glow.addColorStop(
      0.34,
      `rgba(196, 236, 243, ${0.18 + displayStrength * 0.62})`,
    );
    glow.addColorStop(0.72, `rgba(84, 140, 152, ${displayStrength * 0.28})`);
    glow.addColorStop(1, "rgba(225, 252, 255, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);

    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.14 + displayStrength * 0.32})`;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.052, digit * 0.31, digit * 0.31 + Math.PI * 1.3);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
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
  paper.addColorStop(0, "#edf4f5");
  paper.addColorStop(0.72, "#dce8eb");
  paper.addColorStop(1, "#cbd8dc");
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, size, size);

  if (hasInk) {
    drawOutputConfidenceGlow(ctx, size, confidence);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "650 50px Inter, ui-sans-serif, system-ui";

  for (let digit = 0; digit < DIGITS; digit += 1) {
    const anchor = DIGIT_ANCHORS[digit];
    const x = anchor.x * size;
    const y = anchor.y * size;
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = "rgba(36, 52, 56, 0.18)";
    ctx.strokeText(String(digit), x, y);
    ctx.fillStyle = "rgba(36, 52, 56, 0.66)";
    ctx.fillText(String(digit), x, y);
  }

  ctx.strokeStyle = "rgba(88, 120, 128, 0.12)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.45, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
