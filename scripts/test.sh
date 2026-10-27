#!/usr/bin/env bash
# Integration tests need the mock-oracle build (set_mock_price). The production build is checked for O1.
set -euo pipefail
cd "$(dirname "$0")/.."
anchor build -- --features mock-oracle
cp target/idl/limit_plus.json packages/sdk/src/idl.json
cargo test -p limit_plus
yarn ts-mocha -p tsconfig.json -t 120000 "tests/**/*.ts" "packages/*/test/**/*.ts"
