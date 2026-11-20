#!/usr/bin/env bash
# Lean install for the worker on Render. The repo is one yarn workspace with the web app and the pitch video in it, and the
# worker needs neither: installing everything pulls over a gigabyte of Next.js, Remotion and browser tooling onto a free
# build machine. This keeps only the workspaces and dependencies the worker imports, then installs from the same yarn.lock.
# It rewrites package.json inside the build checkout only; nothing is committed.
set -euo pipefail
cd "$(dirname "$0")/.."
node -e '
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const keep = ["@coral-xyz/anchor", "@solana/web3.js", "@solana/spl-token", "bn.js", "js-sha3", "ts-node", "typescript", "@types/node"];
const all = { ...pkg.dependencies, ...pkg.devDependencies };
pkg.workspaces = ["packages/*", "bots"];
pkg.dependencies = Object.fromEntries(keep.filter((k) => all[k]).map((k) => [k, all[k]]));
delete pkg.devDependencies;
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2));
console.log("worker install keeps:", Object.keys(pkg.dependencies).join(", "));
'
# packages/sdk and packages/pricing are workspaces the worker imports; the radar package has no dependencies.
yarn install --ignore-engines --ignore-scripts --non-interactive
