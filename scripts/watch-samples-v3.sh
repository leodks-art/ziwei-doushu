#!/usr/bin/env bash
set -euo pipefail

DEST="${ZIWEI_SAMPLE_DEST:-/opt/ziwei-samples-v3}"
DOWNLOAD_DIR="$DEST/download"
FINALIZE="${ZIWEI_FINALIZE_SCRIPT:-/www/wwwroot/ziwei-doushu-live/scripts/finalize-samples-v3.sh}"
DEADLINE_SECONDS="${ZIWEI_SAMPLE_WATCH_TIMEOUT:-43200}"
STARTED_AT="$(date +%s)"

while true; do
  if ! pgrep -f 'aria2c .*ziwei-samples-v3-part' >/dev/null; then
    break
  fi
  now="$(date +%s)"
  if [ $((now - STARTED_AT)) -gt "$DEADLINE_SECONDS" ]; then
    echo "Timed out waiting for sample downloads" >&2
    exit 1
  fi
  sleep 60
done

if compgen -G "$DOWNLOAD_DIR/*.aria2" >/dev/null; then
  echo "Download did not finish cleanly; .aria2 files remain:" >&2
  ls -lh "$DOWNLOAD_DIR"/*.aria2 >&2
  exit 1
fi

"$FINALIZE"
