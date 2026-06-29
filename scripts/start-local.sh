#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-3000}"
HOST="${HOST:-127.0.0.1}"

export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-http://${HOST}:${PORT}}"

if command -v pnpm >/dev/null 2>&1; then
  PNPM="pnpm"
else
  LOCAL_PNPM="${ROOT}/../tools/bin/pnpm"
  if [ -x "${LOCAL_PNPM}" ]; then
    PNPM="${LOCAL_PNPM}"
  else
    echo "pnpm not found. Install pnpm or run from this Codex workspace where work/tools/bin/pnpm exists." >&2
    exit 1
  fi
fi

cd "${ROOT}"
"${PNPM}" install --config.confirmModulesPurge=false
"${PNPM}" build
exec "${PNPM}" exec next start -H "${HOST}" -p "${PORT}"
