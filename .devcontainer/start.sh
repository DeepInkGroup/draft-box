#!/usr/bin/env bash
set -euo pipefail

# Keep the server running after the setup command exits, and avoid starting a
# second copy if the Codespace already has the application listening.
if ! curl --silent --fail http://localhost:4321/api/health >/dev/null; then
  nohup npm --prefix server start >/tmp/draft-box.log 2>&1 &
fi
