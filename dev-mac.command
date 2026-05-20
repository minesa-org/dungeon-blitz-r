#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "Dungeon Blitz (local dev server)"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js is not installed or not on PATH."
  echo "Install Node.js (LTS) then re-run this file."
  echo
  read -r -p "Press Enter to close..."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: npm is not installed or not on PATH."
  echo "Reinstall Node.js (LTS) then re-run this file."
  echo
  read -r -p "Press Enter to close..."
  exit 1
fi

echo "Node: $(node -v)"
echo "npm:  $(npm -v)"
echo

if [[ ! -d "node_modules" ]]; then
  echo "Installing root dependencies..."
  npm install
  echo
else
  echo "Root dependencies already installed; skipping."
  echo
fi

if [[ ! -d "src/server/node_modules" ]]; then
  echo "Installing server dependencies..."
  (cd "src/server" && npm install)
  echo
else
  echo "Server dependencies already installed; skipping."
  echo
fi

echo "Building Discord Social SDK native bridge..."
(cd "src/server/native_bridge" && ./build-macos.sh)
echo

export DISCORD_SOCIAL_BRIDGE_ENABLED="${DISCORD_SOCIAL_BRIDGE_ENABLED:-true}"
export DISCORD_SOCIAL_NATIVE_BRIDGE_ENABLED="${DISCORD_SOCIAL_NATIVE_BRIDGE_ENABLED:-true}"
export DISCORD_SOCIAL_CHAT_RELAY_MODE="${DISCORD_SOCIAL_CHAT_RELAY_MODE:-native}"
export DISCORD_SOCIAL_APP_ID="1447954255452311695"
export DISCORD_SOCIAL_DEVICE_FLOW="false"
export DISCORD_SOCIAL_BRIDGE_EXECUTABLE="${DISCORD_SOCIAL_BRIDGE_EXECUTABLE:-$ROOT_DIR/src/server/native_bridge/build/discord_social_bridge}"

echo "Starting server + Discord RPC (npm run dev:with-discord)..."
echo "Discord channel bridge enabled: $DISCORD_SOCIAL_BRIDGE_ENABLED"
echo "Discord Social SDK native bridge enabled: $DISCORD_SOCIAL_NATIVE_BRIDGE_ENABLED"
echo "Discord chat relay mode: $DISCORD_SOCIAL_CHAT_RELAY_MODE"
echo "Discord Social SDK app id: $DISCORD_SOCIAL_APP_ID"
echo "Discord Social SDK device flow: $DISCORD_SOCIAL_DEVICE_FLOW"
echo "Discord Social SDK bridge: $DISCORD_SOCIAL_BRIDGE_EXECUTABLE"
echo "When it's ready, open the URL shown in the logs."
echo
set +e
npm run dev:with-discord
EXIT_CODE=$?
set -e

echo
echo "Server exited with code $EXIT_CODE"
read -r -p "Press Enter to close..."
exit "$EXIT_CODE"
