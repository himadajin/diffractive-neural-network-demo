# Third-Party Notices

## MNIST ONNX Model

- File: `public/models/mnist-8.onnx`
- Source: ONNX Model Zoo, `onnxmodelzoo/mnist-8`
- URL: https://huggingface.co/onnxmodelzoo/mnist-8
- License: Apache License 2.0
- SHA256: `2f06e72de813a8635c9bc0397ac447a601bdbfa7df4bebc278723b958831c9bf`
- Modifications: none

## ONNX Runtime Web

- Package: `onnxruntime-web`
- Version: see `package-lock.json`
- URL: https://www.npmjs.com/package/onnxruntime-web
- License: MIT

The runtime WebAssembly file under `public/ort/` is generated locally from the
installed npm package by `npm run prepare:ort` and is not committed.
