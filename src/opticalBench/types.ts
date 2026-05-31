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

export type SceneState = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  inputMesh: THREE.Mesh;
  inputCanvas: HTMLCanvasElement;
  inputTexture: THREE.CanvasTexture;
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
