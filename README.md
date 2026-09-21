# Auditor da Rua

PWA de auditoria multilojas do grupo **Burger da Rua** (São Paulo). O gerente geral e a nutricionista auditam as unidades em rotinas fixas pelo celular; o app calcula notas por critério, ranqueia as lojas todo mês e dá aos proprietários um dashboard de performance e de cumprimento da rotina, com relatórios PDF no fechamento.

## Stack

- **Next.js 15** (App Router, TypeScript, Tailwind v4) — PWA mobile-first instalável, pt-BR, timezone `America/Sao_Paulo`
- **Supabase** — Auth (e-mail/senha), Postgres com RLS, Storage (fotos e PDFs), Edge Functions opcionais
- **Web Push** (`web-push` + service worker) com deep links
- **@react-pdf/renderer** — relatórios mensais gerados no servidor
- **Vercel** — hospedagem e crons (`vercel.json`)

## Setup local

```bash
npm install
cp .env.example .env.local        # preencha Supabase, APP_URL, VAPID, CRON_SECRET, SEED_*
supabase db push                  # ou execute supabase/migrations/0001..0005 no SQL Editor
npm run seed:users                # cria Rodrigo, Daniele, Antonio e Victor
npm run dev                       # http://localhost:3000
```

Requisitos: Node 22+, projeto Supabase criado (ver [docs/DEPLOY.md](docs/DEPLOY.md)).

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest (engine de notas, ranking, agenda, nutricional) |
| `npm run sql:check` | valida a sintaxe das migrations com o parser do Postgres |
| `npm run seed:users` | cria/atualiza os 4 usuários iniciais (idempotente) |
| `node scripts/generate-vapid.mjs` | gera par de chaves VAPID |
| `npx tsx scripts/render-report-sample.tsx [pasta]` | renderiza os PDFs com dados fictícios (padrão `/tmp/auditor-reports`) |

## Deploy

Resumo (detalhes em [docs/DEPLOY.md](docs/DEPLOY.md)):

1. Supabase: projeto → migrations em ordem → seed de usuários → desligar cadastro aberto.
2. Chaves VAPID → variáveis de ambiente.
3. Vercel: importar o repositório, cadastrar variáveis (inclusive `CRON_SECRET`), os crons de `vercel.json` chamam `/api/cron/daily-reminder` (08:00 SP) e `/api/cron/end-of-day` (23:05 SP).
4. Instalar o PWA nos celulares e ativar notificações (iOS 16.4+ exige app na tela de início).
5. Alternativa sem Vercel Cron: Edge Functions (`supabase functions deploy daily-reminder end-of-day --no-verify-jwt`) + pg_cron (migration 0005).

## Estrutura

```
supabase/migrations/   esquema, RLS, seeds, cron
supabase/functions/    Edge Functions (Deno): daily-reminder, end-of-day, _shared
src/lib/domain/        engine de notas, ranking, agenda, nutricional (testada)
src/lib/cron/          lógica dos crons (usada por src/app/api/cron/*)
src/lib/reports/       montagem de dados + documentos PDF + geração/upload
src/app/(app)/         telas autenticadas (auditor, nutri, dashboard, admin)
src/app/api/           cron, push, reports
docs/                  especificação, arquitetura, deploy, notificações
```

## Documentação

- [docs/ESPECIFICACAO.md](docs/ESPECIFICACAO.md) — regras de negócio (v1)
- [docs/ARQUITETURA.md](docs/ARQUITETURA.md) — pastas, rotas, convenções
- [docs/DEPLOY.md](docs/DEPLOY.md) — passo a passo de implantação
- [docs/NOTIFICACOES.md](docs/NOTIFICACOES.md) — tipos de push, horários, dedup e deep links
