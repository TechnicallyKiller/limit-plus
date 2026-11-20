#!/usr/bin/env bash
# Integration tests need the mock-oracle build (set_mock_price). The production build is checked for O1.
set -euo pipefail
cd "$(dirname "$0")/.."
# Newer Solana toolchains default to SBPF v3, which LiteSVM 0.3.x cannot load. Build the .so as v0 (also the safest
# format to deploy), and build the IDL in a separate step because anchor forwards `--arch` to the IDL build.
anchor build --no-idl -- --features mock-oracle --arch v0
anchor idl build -o target/idl/limit_plus.json -- --features mock-oracle
cp target/idl/limit_plus.json packages/sdk/src/idl.json
cargo test -p limit_plus
yarn ts-mocha -p tsconfig.json -t 120000 "tests/limit-plus.ts" "packages/*/test/**/*.ts"
