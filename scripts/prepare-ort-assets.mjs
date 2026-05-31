import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const files = [
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
];

for (const file of files) {
  const source = resolve(root, "node_modules/onnxruntime-web/dist", file);
  const destination = resolve(root, "public/ort", file);

  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
}
