// Copies Stockfish WASM files from node_modules into client/public/stockfish/
// so they are served as static assets without being committed to git.
// Runs on `postinstall` (including on the deployment server).
import { copyFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const src = resolve(root, "node_modules/stockfish/bin");
const dest = resolve(root, "client/public/stockfish");

if (!existsSync(src)) {
  console.warn("[copy-stockfish] stockfish not found in node_modules — skipping.");
  process.exit(0);
}

mkdirSync(dest, { recursive: true });

const files = ["stockfish-18-lite-single.js", "stockfish-18-lite-single.wasm"];

for (const file of files) {
  const from = resolve(src, file);
  if (!existsSync(from)) {
    console.warn(`[copy-stockfish] ${file} not found in ${src} — skipping.`);
    continue;
  }
  copyFileSync(from, resolve(dest, file));
  console.log(`[copy-stockfish] Copied ${file}`);
}
