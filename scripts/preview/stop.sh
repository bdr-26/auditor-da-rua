#!/usr/bin/env bash
# Encerra o mock e o next dev iniciados por run.sh (mata o grupo de processo de cada um).
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PIDS="$ROOT/scripts/preview/.pids"

if [[ -f "$PIDS" ]]; then
  while IFS='=' read -r name pid; do
    [[ -z "${pid:-}" || "$name" == "LOGS" ]] && continue
    if kill -0 "$pid" 2>/dev/null; then
      kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
      echo "parado: $name (pid $pid)"
    fi
  done < "$PIDS"
  rm -f "$PIDS"
else
  echo "Nenhum $PIDS encontrado; procurando processos pelo nome…"
fi

# garantia extra (processos órfãos)
pkill -f "scripts/preview/mock-supabase.mjs" 2>/dev/null || true
pkill -f "next/dist/bin/next dev -p ${PREVIEW_PORT:-3000}" 2>/dev/null || true
sleep 0.5
echo "ok"
