# Diffractive Neural Network Artwork

An interactive visual artwork themed around optical diffraction and neural networks.

This is not a physically rigorous diffractive neural network simulator. The current prototype focuses on visual plausibility: a handwritten digit is drawn onto the first circular optical surface, light-like patterns pass through four fixed relief lens layers, and an opaque output screen marked with digits glows with candidate results.

## Run

```bash
npm install
npm run dev
```

Then open the local Vite URL printed in the terminal.

Use `?debug=1` for numeric camera debug controls.

## GitHub Pages

This project can be hosted as a GitHub Pages project site. The MNIST classifier
runs entirely in the browser through ONNX Runtime Web, so no server-side AI
runtime is required.

The Pages workflow builds the app with `VITE_BASE_PATH=/${REPOSITORY_NAME}/` so
Vite asset URLs work under `https://USER.github.io/REPOSITORY_NAME/`. In the
repository settings, set **Pages** > **Build and deployment** > **Source** to
**GitHub Actions**.

`public/models/mnist-8.onnx` is committed. `public/ort/` is generated from the
installed `onnxruntime-web` package by `npm run prepare:ort` and must not be
committed.

If the deployed page shows 404s for JavaScript, WASM, or ONNX assets, check that
the Pages source is set to GitHub Actions, the workflow passed
`VITE_BASE_PATH=/${REPOSITORY_NAME}/`, and the deployment artifact contains
`models/mnist-8.onnx` and `ort/ort-wasm-simd-threaded.jsep.{mjs,wasm}`.

## Current Prototype

- Vite + React + TypeScript
- Fixed-camera Three.js scene
- Desktop landscape composition
- Handwritten input directly on the first circular optical surface
- Four fixed circular relief lens layers
- Quiet white environment with cool white to cyan light accents
- Opaque output screen with upright 0 through 9 marks arranged around a circle
- Local ONNX Runtime Web MNIST classifier driving the confidence glow

## Docs

- Project vocabulary: `docs/CONTEXT.md`
- Agent instructions: `AGENTS.md`
- Third-party notices: `THIRD_PARTY_NOTICES.md`
