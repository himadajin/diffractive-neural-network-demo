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
