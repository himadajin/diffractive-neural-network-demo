# Diffractive Neural Network Artwork

An interactive visual artwork themed around optical diffraction and neural networks.

This is not a physically rigorous diffractive neural network simulator. The current Phase 1 prototype focuses on the visual behavior: a handwritten digit is drawn onto the first optical surface, light-like patterns pass through four fixed relief glass layers, and a labelled detector array glows with provisional confidence values.

## Run

```bash
npm install
npm run dev
```

Then open the local Vite URL printed in the terminal.

## Current Prototype

- Vite + React + TypeScript
- Canvas 2D rendering
- Desktop landscape composition
- Handwritten input directly on the first optical surface
- Four fixed relief glass layers
- Cool white to cyan light palette with subtle spectral accents
- Detector array labelled 0 through 9
- Provisional confidence glow for Phase 1 visual testing

## Implementation Note

The final classifier will be a small learned MNIST digit recognizer, likely through ONNX Runtime Web. The optical visuals are a Visual Plausibility Simulation: they are designed to make the light behavior feel coherent and beautiful, not to claim scientific accuracy as an optical solver.
