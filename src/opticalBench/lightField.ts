import { DIGIT_ANCHORS } from "./constants";
import type { InputLightSample } from "./types";

export const CELL_FIELD_GRID_SIZE = 28;

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

export function outputDisplayStrength(confidence: number[], strength: number) {
  const maxConfidence = Math.max(...confidence);
  if (maxConfidence <= 0.0005 || strength <= 0.0005) return 0;
  const contrastStretched = strength / Math.max(maxConfidence, 0.34);
  return Math.min(1, Math.pow(contrastStretched, 0.72));
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function cellIndex(x: number, y: number) {
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

export function fieldFromSamples(samples: InputLightSample[]) {
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

export function buildFirstLensField(
  samples: InputLightSample[],
  layer: number,
) {
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

export function buildCircuitField(samples: InputLightSample[], layer: number) {
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

export function buildFeatureBundleField(
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

export function buildCandidateField(
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
