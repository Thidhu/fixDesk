#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Opening the download page..."
  open https://nodejs.org
  read -p "Install Node.js (LTS version), then open this file again. Press Enter."
  exit
fi
[ -d node_modules ] || { echo "Setting up, please wait a minute..."; npm install --omit=dev; }
node agent.js
read -p "Press Enter to close."
