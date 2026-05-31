import type * as THREE from "three";

export type Point = {
  x: number;
  y: number;
};

export type Point3 = {
  x: number;
  y: number;
  z: number;
};

export type CameraConfig = {
  position: Point3;
  target: Point3;
  fov: number;
};

export type InputLightSample = {
  x: number;
  y: number;
  nx: number;
  ny: number;
  alpha: number;
};

export type SceneState = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  inputMesh: THREE.Mesh;
  inputCanvas: HTMLCanvasElement;
  inputSurfaceCanvas: HTMLCanvasElement;
  inputTexture: THREE.CanvasTexture;
  inputLightSamples: InputLightSample[];
  normalizedInput: Float32Array | null;
  textureDirty: boolean;
  lensBaseCanvases: HTMLCanvasElement[];
  lensCanvases: HTMLCanvasElement[];
  lensTextures: THREE.CanvasTexture[];
  outputCanvas: HTMLCanvasElement;
  outputTexture: THREE.CanvasTexture;
  confidence: number[];
  targetConfidence: number[];
  classificationRequestId: number;
  classificationInFlight: boolean;
  classificationQueued: boolean;
  hasInk: boolean;
  animationFrame: number;
  onInkChange: (hasInk: boolean) => void;
};
