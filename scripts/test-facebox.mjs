#!/usr/bin/env node
/**
 * Offline guard for the face-bbox coordinate contract.
 *
 * Regression protected: the pipeline used to store face boxes in DETECTION-FRAME
 * pixels (e.g. a ~256px thumbnail) while the UI crops against the full-size
 * preview/original (~1347px), producing wildly wrong crops. faceBox() must rescale
 * the normalized detector coords to ORIGINAL-image pixels.
 *
 * This test extracts the REAL faceBox() from the Edge Function source (strips the
 * TS parameter types, no tsc needed) and asserts the conversion + the anti-regression
 * guard: an original ~1347px-wide image must NOT yield a box whose max coord is <=~256.
 *
 * Run:  node scripts/test-facebox.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "supabase/functions/process-pipeline/index.ts"), "utf8");

const m = src.match(/function faceBox\([\s\S]*?\n\}/);
if (!m) { console.error("FAIL: could not locate faceBox() in the Edge Function source"); process.exit(1); }
// Strip the TS parameter annotations from the signature (body is plain JS).
const jsFn = m[0].replace(
  /function faceBox\([^)]*\)/,
  "function faceBox(f, origW, origH)",
);
// eslint-disable-next-line no-new-func
const faceBox = new Function(`${jsFn}; return faceBox;`)();

let failures = 0;
const ok = (name, cond) => { if (!cond) failures++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}`); };

// The user's real example: detector on a 256x171 thumbnail, original image 1347x898.
const fw = 256, fh = 171, origW = 1347, origH = 898;
const raw = [131.43, 37.07, 131.43 + 19.68, 37.07 + 25.49]; // x1,y1,x2,y2 in the 256px frame
const f = {
  bbox: raw,
  bbox_norm: [raw[0] / fw, raw[1] / fh, raw[2] / fw, raw[3] / fh],
  frame: [fw, fh],
  det_score: 0.99,
  embedding: [],
};

const b = faceBox(f, origW, origH);
const x2 = b.x + b.width, y2 = b.y + b.height;
ok("x2 scaled into original space (>256, <=origW)", x2 > 256 && x2 <= origW + 1);
ok("y2 within original height", y2 <= origH + 1);
ok("x ~ raw*origW/fw", Math.abs(b.x - raw[0] * origW / fw) < 0.01);
ok("width ~ 19.68*origW/fw", Math.abs(b.width - 19.68 * origW / fw) < 0.01);
ok("{x,y} and {left,top} aliases both set", b.left === b.x && b.top === b.y);
ok("source dims recorded", b.source_width === origW && b.source_height === origH);

// Fallback when original dims are unknown: keep detection-frame px + frame size.
const fb = faceBox(f, null, null);
ok("fallback keeps detection-frame px + frame size", Math.abs(fb.x - raw[0]) < 0.01 && fb.source_width === fw);

// The core anti-regression guard.
ok("GUARD: original ~1347px must NOT yield a box max coord <=256 (the old bug)", x2 > 256);

console.log(`\nconverted box: ${JSON.stringify({ x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), x2: Math.round(x2) })}`);
if (failures) { console.error(`\n✗ ${failures} assertion(s) failed`); process.exit(1); }
console.log("\n✓ faceBox coordinate contract verified");
