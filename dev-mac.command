#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

DEV_URL="${DEV_URL:-http://localhost:8000/}"
FLASH_BROWSER_APP_NAME="${FLASH_BROWSER_APP_NAME:-FlashBrowser}"
FLASH_BROWSER_OPEN_ATTEMPTS="${FLASH_BROWSER_OPEN_ATTEMPTS:-120}"
FLASH_BROWSER_OPEN_DELAY_SECONDS="${FLASH_BROWSER_OPEN_DELAY_SECONDS:-1}"

open_flashbrowser_when_ready() {
  local url="$1"
  local app_name="$2"
  local attempts="$3"
  local delay_seconds="$4"
  local attempt
  local total_seconds

  total_seconds=$((attempts * delay_seconds))

  echo "Waiting for $url before opening $app_name..."

  for ((attempt = 1; attempt <= attempts; attempt++)); do
    if curl -fsS --max-time 2 "$url" >/dev/null 2>&1; then
      echo "Opening $url in $app_name..."

      if ! open -a "$app_name" "$url" >/dev/null 2>&1; then
        echo "WARNING: Could not open $app_name."
        echo "Install FlashBrowser, or set FLASH_BROWSER_APP_NAME to the installed app name."
        echo "Then open $url manually."
      fi

      return 0
    fi

    sleep "$delay_seconds"
  done

  echo "WARNING: $url did not become ready after $total_seconds seconds."
  echo "Open it manually in $app_name once the server is ready."
}

FLASH_BROWSER_WATCHER_PID=""

cleanup_flashbrowser_watcher() {
  if [[ -n "$FLASH_BROWSER_WATCHER_PID" ]]; then
    kill "$FLASH_BROWSER_WATCHER_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup_flashbrowser_watcher EXIT

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

BRIDGE_DIR="$ROOT_DIR/src/server/native_bridge"
BRIDGE_SDK_DIR="$BRIDGE_DIR/discord_social_sdk"
BRIDGE_EXECUTABLE="$BRIDGE_DIR/build/discord_social_bridge"

if [[ -x "$BRIDGE_DIR/build-macos.sh" && -d "$BRIDGE_SDK_DIR" ]]; then
  echo "Building Discord Social SDK native bridge..."
  (cd "$BRIDGE_DIR" && ./build-macos.sh)
  echo
elif [[ -x "$BRIDGE_EXECUTABLE" ]]; then
  echo "Discord Social SDK folder not installed; reusing existing native bridge build."
  echo
else
  echo "Discord Social SDK native bridge is not installed; skipping native bridge build."
  echo "Run npm run install:discord-social-sdk to install the optional SDK files."
  echo
fi

export DISCORD_SOCIAL_BRIDGE_EXECUTABLE="${DISCORD_SOCIAL_BRIDGE_EXECUTABLE:-$BRIDGE_EXECUTABLE}"

if [[ -x "$DISCORD_SOCIAL_BRIDGE_EXECUTABLE" ]]; then
  export DISCORD_SOCIAL_BRIDGE_ENABLED="${DISCORD_SOCIAL_BRIDGE_ENABLED:-true}"
  export DISCORD_SOCIAL_NATIVE_BRIDGE_ENABLED="${DISCORD_SOCIAL_NATIVE_BRIDGE_ENABLED:-true}"
  export DISCORD_SOCIAL_CHAT_RELAY_MODE="${DISCORD_SOCIAL_CHAT_RELAY_MODE:-native}"
else
  export DISCORD_SOCIAL_BRIDGE_ENABLED="false"
  export DISCORD_SOCIAL_NATIVE_BRIDGE_ENABLED="false"
  export DISCORD_SOCIAL_CHAT_RELAY_MODE="off"
fi

export DISCORD_SOCIAL_APP_ID="1447954255452311695"
export DISCORD_SOCIAL_DEVICE_FLOW="false"

echo "Starting server + Discord RPC (npm run dev:with-discord)..."
echo "Discord channel bridge enabled: $DISCORD_SOCIAL_BRIDGE_ENABLED"
echo "Discord Social SDK native bridge enabled: $DISCORD_SOCIAL_NATIVE_BRIDGE_ENABLED"
echo "Discord chat relay mode: $DISCORD_SOCIAL_CHAT_RELAY_MODE"
echo "Discord Social SDK app id: $DISCORD_SOCIAL_APP_ID"
echo "Discord Social SDK device flow: $DISCORD_SOCIAL_DEVICE_FLOW"
echo "Discord Social SDK bridge: $DISCORD_SOCIAL_BRIDGE_EXECUTABLE"
echo "FlashBrowser URL: $DEV_URL"
echo
open_flashbrowser_when_ready "$DEV_URL" "$FLASH_BROWSER_APP_NAME" "$FLASH_BROWSER_OPEN_ATTEMPTS" "$FLASH_BROWSER_OPEN_DELAY_SECONDS" &
FLASH_BROWSER_WATCHER_PID=$!
set +e
npm run dev:with-discord
EXIT_CODE=$?
set -e

echo
echo "Server exited with code $EXIT_CODE"
read -r -p "Press Enter to close..."
exit "$EXIT_CODE"
