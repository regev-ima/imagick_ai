#!/usr/bin/env node
/**
 * Bundle-size budget check.
 *
 * Walks dist/assets/*.js (created by `vite build`), measures gzipped
 * size of each chunk and the total, and fails the build if any limit
 * is exceeded. Run after `bun run build` in CI.
 *
 * The thresholds below should be ratcheted DOWN over time, never up.
 * If a chunk legitimately needs more headroom because of a new feature,
 * raise its budget here in the same PR — that makes the cost reviewable.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { promisify } from "node:util";

const gzip = promisify(zlib.gzip);

const DIST_DIR = path.resolve(process.cwd(), "dist", "assets");

// All values are gzipped KB and reflect "current size + ~20% headroom".
// Goal: catch surprise regressions, not to pin the bytes exactly.
// Ratchet these DOWN when shipping wins; only raise them in a PR that
// explains the new dependency.
const BUDGETS_KB = {
  // Initial app shell — main entry chunk. Critical for first paint.
  "index-": 110,
  "radix-": 110,
  "recharts-": 130,
  "face-api-": 180,
  "framer-": 60,
  "sentry-": 12,
};

// Hard cap on the total of all .js chunks combined (gzipped). A regression
// here means we shipped a heavy dep; investigate before bumping.
const TOTAL_BUDGET_KB = 1700;

function kb(bytes) {
  return Math.ceil(bytes / 1024);
}

function findBudget(filename) {
  for (const [prefix, limit] of Object.entries(BUDGETS_KB)) {
    if (filename.startsWith(prefix)) return { prefix, limit };
  }
  return null;
}

async function main() {
  let entries;
  try {
    entries = await fs.readdir(DIST_DIR);
  } catch (err) {
    console.error(`✗ ${DIST_DIR} not found — run \`bun run build\` first.`);
    process.exit(1);
  }

  const jsFiles = entries.filter((f) => f.endsWith(".js"));
  if (jsFiles.length === 0) {
    console.error(`✗ No .js chunks in ${DIST_DIR}`);
    process.exit(1);
  }

  let totalGz = 0;
  const violations = [];
  const lines = [];

  for (const file of jsFiles.sort()) {
    const full = path.join(DIST_DIR, file);
    const buf = await fs.readFile(full);
    const gz = await gzip(buf);
    totalGz += gz.length;

    const budget = findBudget(file);
    const sizeKb = kb(gz.length);
    if (budget && sizeKb > budget.limit) {
      violations.push(`${file}: ${sizeKb} KB > budget ${budget.limit} KB (prefix "${budget.prefix}")`);
      lines.push(`  ✗ ${file.padEnd(46)} ${String(sizeKb).padStart(4)} KB gz   (budget ${budget.limit} KB)`);
    } else if (budget) {
      lines.push(`  ✓ ${file.padEnd(46)} ${String(sizeKb).padStart(4)} KB gz   (budget ${budget.limit} KB)`);
    } else {
      lines.push(`    ${file.padEnd(46)} ${String(sizeKb).padStart(4)} KB gz   (no budget)`);
    }
  }

  console.log("Bundle gz sizes:");
  for (const line of lines) console.log(line);

  const totalKb = kb(totalGz);
  const totalLine = `Total: ${totalKb} KB gz   (budget ${TOTAL_BUDGET_KB} KB)`;
  if (totalKb > TOTAL_BUDGET_KB) {
    violations.push(`Total ${totalKb} KB > ${TOTAL_BUDGET_KB} KB`);
    console.log(`✗ ${totalLine}`);
  } else {
    console.log(`✓ ${totalLine}`);
  }

  if (violations.length > 0) {
    console.error("\nBundle-size budget violated:");
    for (const v of violations) console.error(`  - ${v}`);
    console.error(
      "\nIf this regression is intentional, raise the relevant budget in scripts/check-bundle-size.mjs in the same PR.",
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
