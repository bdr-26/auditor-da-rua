# Deploy — Auditor da Rua

Passo a passo para colocar o app no ar: Supabase (banco, auth, storage) + Vercel (Next.js, crons) + Web Push.

## 1. Projeto Supabase

1. Crie um projeto em <https://supabase.com> (região `South America (São Paulo)` recomendada).
2. Anote em **Project Settings → API**: `Project URL`, `anon public key` e `service_role key`.
3. Em **Authentication → Providers → Email**: mantenha e-mail/senha ativo e **desligue "Enable email signups"**
   (não há cadastro aberto; os usuários são criados pelo seed).
4. Em **Authentication → URL Configuration**: `Site URL` = URL pública do app (ex.: `https://auditor.burgerdarua.com.br`).

## 2. Migrations

As migrations ficam em `supabase/migrations/` e devem rodar **na ordem**:

| Arquivo | Conteúdo |
|---|---|
| `0001_schema.sql` | tabelas, enums, triggers, buckets `audit-photos` e `reports` |
| `0002_rls.sql` | políticas RLS e de storage |
| `0003_seed_core.sql` | unidades, parâmetros (`app_settings`) e templates das auditorias |
| `0004_seed_nutri.sql` | banco de itens nutricionais e composição por loja (Anexos A, B, C) |
| `0005_cron.sql` | pg_cron + pg_net + função `schedule_notification_jobs()` (alternativa ao Vercel Cron) |

**Opção A — CLI (recomendado)**

```bash
npm i -g supabase          # ou npx supabase
supabase login
supabase link --project-ref <PROJECT_REF>
supabase db push           # aplica 0001..0005 em ordem
```

**Opção B — SQL Editor**: abra cada arquivo e execute o conteúdo, do 0001 ao 0005.

Os buckets de storage (`audit-photos`, privado, 5 MB, jpeg/png/webp; `reports`, privado, 20 MB, pdf) são criados pela migration 0001.
Valide a sintaxe localmente com `npm run sql:check`.

## 3. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

| Variável | Onde usar | Descrição |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | local + Vercel | URL do projeto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | local + Vercel | chave anon (RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | local + Vercel | chave service_role — **nunca** expor no client |

> **Integração Supabase ↔ Vercel**: se você conectar os dois pelo marketplace do Vercel, ela cria sozinha as variáveis do Supabase
> (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_URL`, `POSTGRES_*`…). O app aceita
> esses nomes; basta acrescentar as demais (`NEXT_PUBLIC_APP_URL`, VAPID e `CRON_SECRET`).
| `NEXT_PUBLIC_APP_URL` | local + Vercel | URL pública (deep links dos pushes) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | local + Vercel | Web Push (seção 5) |
| `CRON_SECRET` | Vercel (+ Supabase, se usar pg_cron) | protege `/api/cron/*` |
| `SEED_DEFAULT_PASSWORD`, `SEED_EMAIL_*` | só local | seed de usuários (seção 4) |

## 4. Usuários iniciais

```bash
npm run seed:users
```

Cria (idempotente) no Supabase Auth, com e-mail confirmado e perfil em `profiles`:

| Nome | Perfil | E-mail (env) |
|---|---|---|
| Rodrigo | `auditor_geral` | `SEED_EMAIL_RODRIGO` |
| Daniele | `auditor_nutricao` | `SEED_EMAIL_DANIELE` |
| Antonio | `proprietario` | `SEED_EMAIL_ANTONIO` |
| Victor | `proprietario` | `SEED_EMAIL_VICTOR` |

Senha inicial: `SEED_DEFAULT_PASSWORD` (ou `SEED_PASSWORD_<NOME>` por pessoa). Peça a troca no primeiro acesso.

## 5. Chaves VAPID (Web Push)

```bash
npx web-push generate-vapid-keys
# ou
node scripts/generate-vapid.mjs
```

Coloque a pública em `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, a privada em `VAPID_PRIVATE_KEY` e um contato em `VAPID_SUBJECT` (`mailto:…`).
As mesmas chaves valem para o Vercel e para as Edge Functions (seção 8). Trocar as chaves invalida todas as subscriptions existentes.

## 6. Deploy no Vercel

1. Importe o repositório no Vercel (framework Next.js, sem configuração extra; `next.config.ts` já marca `@react-pdf/renderer` como pacote externo do servidor).
2. Cadastre as variáveis da seção 3 (Production e Preview). Gere um `CRON_SECRET` forte: `openssl rand -hex 32`.
3. `vercel.json` já declara os crons:

   | Rota | Cron (UTC) | Horário SP | O que faz |
   |---|---|---|---|
   | `/api/cron/daily-reminder` | `0 11 * * *` | 08:00 | lembrete da auditoria do dia (ter–dom; segunda não há agenda) |
   | `/api/cron/end-of-day` | `5 2 * * *` | 23:05 (dia anterior) | marca dias não cumpridos e avisa |

   O Vercel envia automaticamente `Authorization: Bearer $CRON_SECRET` nas chamadas dos crons. No plano Hobby o horário pode variar dentro da hora.
4. Aponte o domínio (ex.: `auditor.burgerdarua.com.br`) e atualize `NEXT_PUBLIC_APP_URL` e o `Site URL` do Supabase.

Teste manual dos crons (qualquer ambiente):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "$NEXT_PUBLIC_APP_URL/api/cron/daily-reminder"
curl -H "Authorization: Bearer $CRON_SECRET" "$NEXT_PUBLIC_APP_URL/api/cron/end-of-day?data=2026-09-25"
```

## 7. Instalar o PWA no celular

- **iPhone (Safari)**: abra a URL → botão Compartilhar → **Adicionar à Tela de Início**. Abra o app pelo ícone e toque em **Ativar notificações**.
  Push no iOS exige **iOS 16.4+** e que o app esteja **instalado na tela de início** (no Safari comum não funciona).
- **Android (Chrome)**: abra a URL → menu ⋮ → **Instalar app** (ou o banner "Adicionar à tela inicial"). Depois, **Ativar notificações**.
- Cada aparelho gera a própria subscription; o mesmo usuário pode ativar em vários aparelhos.

## 8. Alternativa Supabase-nativa: Edge Functions + pg_cron

Use se preferir não depender do Vercel Cron. As functions em `supabase/functions/` reproduzem a mesma lógica dos endpoints `/api/cron/*`.

```bash
supabase functions deploy daily-reminder end-of-day --no-verify-jwt
supabase secrets set CRON_SECRET=... APP_URL=https://auditor.burgerdarua.com.br \
  VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:contato@burgerdarua.com.br
```

(`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem automaticamente nas functions.)

Agendamento com pg_cron (migration `0005_cron.sql` já criou a função). No SQL Editor:

```sql
select vault.create_secret('https://<PROJECT_REF>.supabase.co', 'project_url');
select vault.create_secret('<CRON_SECRET>', 'cron_secret');
select public.schedule_notification_jobs();   -- cria/recria os jobs
select jobname, schedule, active from cron.job;  -- conferir
```

Para desligar: `select cron.unschedule('auditor-daily-reminder'); select cron.unschedule('auditor-end-of-day');`.
Não rode Vercel Cron e pg_cron ao mesmo tempo — funciona (há dedup por `notifications_log`), mas é redundante.

## 9. Fechamento e relatórios

- O proprietário fecha o mês em `/dashboard/fechamento` → notas congeladas em `monthly_closings` → PDFs gerados (`YYYY-MM/<slug>.pdf` e `YYYY-MM/consolidado.pdf` no bucket `reports`) e listados na tela.
- Regerar: `POST /api/reports/generate` com `{ "mes": "2026-09" }` (sessão de proprietário). Se o mês ainda não foi fechado, o PDF sai marcado como **PRÉVIA** com valores calculados na hora.
- Pré-visualizar o layout sem banco: `npx tsx scripts/render-report-sample.tsx` (gera em `/tmp/auditor-reports`).

## 10. Checklist pós-deploy

- [ ] login dos 4 usuários funciona
- [ ] `/auditor/agenda` mostra o mês atual e o próximo (agenda materializada no primeiro acesso ou pelo cron)
- [ ] push ativado no celular do Rodrigo e dos proprietários (`push_subscriptions` com linhas)
- [ ] `curl` nos dois crons responde `{"ok":true,…}`
- [ ] foto de uma auditoria aparece em `audit-photos` e no resumo
- [ ] fechamento de um mês de teste gera os PDFs
