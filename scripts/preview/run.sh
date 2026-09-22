#!/usr/bin/env bash
# Sobe o mock do Supabase (porta 54321) e o `next dev` (porta 3000) apontando para ele.
# PIDs (grupos de processo) ficam em scripts/preview/.pids.
# Logs ficam FORA do repositório (PREVIEW_LOG_DIR, padrão /tmp/auditor-da-rua-preview):
# o watcher do next dev observa a árvore do projeto e um log crescendo dentro dela
# dispara recompilações em loop.
# Uso: scripts/preview/run.sh        (ou: npm run preview)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PREVIEW="$ROOT/scripts/preview"
LOGS="${PREVIEW_LOG_DIR:-${TMPDIR:-/tmp}/auditor-da-rua-preview}"
PIDS="$PREVIEW/.pids"
MOCK_PORT="${MOCK_SUPABASE_PORT:-54321}"
APP_PORT="${PREVIEW_PORT:-3000}"

cd "$ROOT"
mkdir -p "$LOGS"

if [[ -f "$PIDS" ]]; then
  echo "Já existe um preview registrado em $PIDS — rodando stop.sh antes de continuar."
  "$PREVIEW/stop.sh" || true
fi

cat > .env.preview <<EOF
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:${MOCK_PORT}
NEXT_PUBLIC_SUPABASE_ANON_KEY=mock
SUPABASE_SERVICE_ROLE_KEY=mock
NEXT_PUBLIC_APP_URL=http://localhost:${APP_PORT}
CRON_SECRET=dev
EOF

# --- mock Supabase (grupo de processo próprio para o stop.sh matar tudo) ---
: > "$LOGS/mock.log"
MOCK_SUPABASE_PORT="$MOCK_PORT" setsid node "$PREVIEW/mock-supabase.mjs" > "$LOGS/mock.log" 2>&1 &
MOCK_PID=$!

for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${MOCK_PORT}/health" > /dev/null 2>&1; then break; fi
  sleep 0.3
done
if ! curl -fsS "http://127.0.0.1:${MOCK_PORT}/health" > /dev/null 2>&1; then
  echo "O mock não respondeu na porta ${MOCK_PORT}. Veja $LOGS/mock.log"; kill "$MOCK_PID" 2>/dev/null || true; exit 1
fi
echo "mock Supabase: http://127.0.0.1:${MOCK_PORT}  (pid $MOCK_PID)"

# --- next dev com as variáveis do preview (process.env vence o .env.local) ---
: > "$LOGS/next.log"
env $(cat .env.preview | xargs) setsid node "$ROOT/node_modules/next/dist/bin/next" dev -p "$APP_PORT" > "$LOGS/next.log" 2>&1 &
NEXT_PID=$!

printf 'MOCK=%s\nNEXT=%s\nLOGS=%s\n' "$MOCK_PID" "$NEXT_PID" "$LOGS" > "$PIDS"

echo -n "aguardando o Next ficar pronto"
READY=0
for _ in $(seq 1 180); do
  if grep -q "Ready" "$LOGS/next.log" 2>/dev/null; then READY=1; break; fi
  if ! kill -0 "$NEXT_PID" 2>/dev/null; then break; fi
  echo -n "."; sleep 1
done
echo
if [[ "$READY" != "1" ]]; then
  echo "O Next não ficou pronto. Últimas linhas de $LOGS/next.log:"; tail -20 "$LOGS/next.log"; exit 1
fi

cat <<EOF

Preview no ar:  http://localhost:${APP_PORT}/login
Usuários (qualquer senha):
  antonio@bdr-auditor.app  proprietário
  rodrigo@bdr-auditor.app  gerente (auditor_geral)
  dani@bdr-auditor.app     nutricionista

Logs:   $LOGS/next.log · $LOGS/mock.log
Parar:  scripts/preview/stop.sh   (ou: kill -- -\$PID para cada PID em $PIDS)
Fotos:  npm run preview:shots -- <dani|rodrigo|antonio> <pasta-de-saida> [largura] [altura]
EOF
