// Renders a list of frames from one bundle: node scripts/stills.mjs Pitch 285 390 ...
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "path";
const [id, ...frames] = process.argv.slice(2);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const comp = await selectComposition({ serveUrl, id });
for (const f of frames) await renderStill({ composition: comp, serveUrl, frame: +f, output: `out/s${f}.png` });
console.log("done", frames.join(","));
