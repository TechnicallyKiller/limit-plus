#!/usr/bin/env bash
# Limit+ — one-time dev environment setup (macOS, Linux, or Windows via WSL/Ubuntu).
# Safe to re-run: it skips anything already installed and never overwrites your keypair.
set -euo pipefail

ANCHOR_VERSION="0.32.1"          # pinned: Switchboard's SDK is not compatible with Anchor 1.0
CLUSTER="${CLUSTER:-devnet}"

say()  { printf "\n\033[1;33m»\033[0m %s\n" "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }

export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$HOME/.avm/bin:$HOME/.local/bin:$PATH"

say "1/6  Solana toolchain (Rust, Solana CLI, Anchor/AVM, Surfpool, Node.js, Yarn)"
if have solana && have cargo && have avm && have node && have yarn; then
  echo "Already installed — skipping the Solana installer."
else
  curl --proto '=https' --tlsv1.2 -sSfL https://solana-install.solana.workers.dev | bash
fi

say "2/6  Pin Anchor CLI to ${ANCHOR_VERSION}"
if ! have avm; then
  echo "avm not found. Re-run the Solana installer above, open a new terminal, then run this script again." >&2
  exit 1
fi
if anchor --version 2>/dev/null | grep -q "${ANCHOR_VERSION}"; then
  echo "anchor-cli ${ANCHOR_VERSION} already active."
else
  avm install "${ANCHOR_VERSION}"
  avm use "${ANCHOR_VERSION}"
fi

say "3/6  Claude Code"
if have claude; then
  claude --version
else
  curl -fsSL https://claude.ai/install.sh | bash
  echo "Claude Code installed. Run 'claude' once to log in (needs a paid Claude plan or an Anthropic Console account)."
fi

say "4/6  Solana keypair + cluster (${CLUSTER})"
KEYPAIR="$HOME/.config/solana/id.json"
if [ -f "$KEYPAIR" ]; then
  echo "Keypair exists: $KEYPAIR (not touching it)"
else
  mkdir -p "$(dirname "$KEYPAIR")"
  solana-keygen new --no-bip39-passphrase -o "$KEYPAIR"
fi
solana config set --url "$CLUSTER" >/dev/null
echo "Wallet: $(solana address)"

say "5/6  Devnet SOL"
if [ "$CLUSTER" = "devnet" ]; then
  solana airdrop 2 || echo "Airdrop rate-limited. Use https://faucet.solana.com with the wallet address above."
  solana balance || true
fi

say "6/6  Versions"
rustc --version || true
solana --version || true
anchor --version || true
(surfpool --version 2>/dev/null) || echo "surfpool: not found (optional; solana-test-validator works too)"
node --version || true
yarn --version || true
claude --version 2>/dev/null || echo "claude: open a new terminal if this is a fresh install"

cat <<'NEXT'

Done. Next:
  1) ./scripts/bootstrap.sh            # creates the Anchor project and copies this kit into it
  2) cd limit-plus && claude           # start Claude Code in the project
  3) In Claude Code type: /phase-0-scaffold
NEXT
