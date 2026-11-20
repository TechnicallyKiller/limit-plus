# Deploying the demo

Three pieces: the program on devnet, the worker (Render), and the web app (Vercel).

## 1. Program on devnet

The demo uses the mock-oracle build, because Friday's real close cannot be waited for. Build it as SBPF v0 so it loads
everywhere (newer toolchains default to v3):

```bash
anchor build --no-idl -- --features mock-oracle --arch v0
solana program deploy target/deploy/limit_plus.so --program-id ~/.config/limitplus/program-keypair.json \
  --keypair ~/.config/limitplus/deployer.json --url devnet
```

The program id is `HzCjmdAX5qrDgX8eEgJ6oBBJLy9nWqtE3wTVcdzQeVkB`. Its keypair is **not** in the repo. Keep it safe: without it
the program can never be upgraded. Deploying locks about 3.1 devnet SOL of rent, plus fees. The devnet RPC faucet is closed, so get
SOL from https://faucet.solana.com.

Then create the mock tokens and the program config (safe to re-run):

```bash
yarn ts-node -P tsconfig.json scripts/setup-devnet.ts --rpc https://api.devnet.solana.com \
  --admin ~/.config/limitplus/deployer.json --config config/addresses.devnet.json
```

## 2. Worker on Render

`render.yaml` describes it. Set `SOLANA_RPC_URL`, `ADMIN_KEYPAIR` (the JSON array of the admin key), `QUOTE_MINT`,
`UNDERLYING_MINT` (both from `config/addresses.devnet.json`) and `TINYFISH_API_KEY`. `WORKER_SHARED_SECRET` is generated: copy
the same value to the web app. The build runs `scripts/render-build.sh`, which installs only what the worker needs.

Health: `GET /health`. Status (RPC, admin SOL balance, radar freshness, demo state): `GET /status`.

## 3. Web app on Vercel

Root directory `app`, Node 24. Environment:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_RPC_URL` | the same devnet RPC |
| `NEXT_PUBLIC_CLUSTER` | `devnet` |
| `NEXT_PUBLIC_DEMO` | `1` (turns on the demo wallet and the Demo tab) |
| `WORKER_URL` | the Render service URL |
| `WORKER_SHARED_SECRET` | same value as on the worker |
| `RADAR_UPSTREAM_URL` | the Render service URL (live Risk radar) |

`NEXT_PUBLIC_*` values are baked in at build time, so redeploy after changing them.

## Run all of it locally

```bash
anchor build --no-idl -- --features mock-oracle --arch v0
yarn ts-node -P tsconfig.json scripts/local-stack.ts          # validator, mints, worker; prints STACK_READY
# in another terminal, with the secret from /tmp/limitplus-local.json:
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8899 NEXT_PUBLIC_DEMO=1 yarn workspace app build
WORKER_URL=http://127.0.0.1:8787 WORKER_SHARED_SECRET=... yarn workspace app start
```

## Tests

| Command | What it proves |
|---|---|
| `./scripts/test.sh` | Rust unit tests, 21 integration scenarios, SDK, pricing and Risk Radar tests |
| `yarn ts-node -P tsconfig.json scripts/worker-e2e.ts` | The worker and API on a real validator: two full weeks, a restart mid-week, rate limits |
| `node tools/qa/capture.mjs <dir>` | Every page at desktop and mobile: no console errors, no horizontal scroll, design rules |
| `node tools/qa/radar.mjs` | Risk Radar UI in every state, including failures |
| `node tools/qa/demo-flow.mjs buy <dir>` | A visitor plays a whole week in a real browser, recorded, verified on chain |

Validator ledgers go to `~/.cache/limitplus` (set `LIMITPLUS_LEDGER_DIR` to move them) and are removed on exit.
