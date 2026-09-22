# Notificações — Auditor da Rua

Web Push (VAPID) com deep link. O service worker (`public/sw.js`) mostra a notificação e, no toque, abre/foca o app na `url` recebida. Cada usuário ativa o push por aparelho (`push_subscriptions`); o envio é feito **sempre pelo servidor** com `sendPushToUsers(admin, ids, tipo, chaveDedup, payload)` (`src/lib/push.ts`).

## Dedup

Antes de enviar, o servidor grava `(user_id, chave_dedup)` em `notifications_log` (constraint `unique`). Se a linha já existe, o push não é reenviado — por isso os crons podem rodar mais de uma vez no dia sem duplicar avisos. Subscriptions expiradas (404/410) são apagadas automaticamente.

O payload é `{ titulo, corpo, url, tag? }`. `tag` agrupa notificações no aparelho (uma substitui a outra).

## Os 4 tipos

| # | `tipo` | Quem recebe | Quando | `chave_dedup` | Deep link (`url`) |
|---|---|---|---|---|---|
| 1 | `lembrete_8h` | gerente (auditor do dia; se a agenda não tem auditor, todos os `auditor_geral` ativos) | 08:00 SP, ter–dom, se há `schedule_days` com `status = 'prevista'` para hoje | `lembrete:YYYY-MM-DD` | `/auditor?data=YYYY-MM-DD` (home com o card "Auditoria de hoje" → Iniciar) |
| 2 | `auditoria_concluida` | proprietários | ao concluir qualquer auditoria (server action de conclusão, gerente ou nutricionista) | `<audit_id>` | `/auditorias/<id>/resumo` (gerente) · `/nutri/auditorias/<id>/resumo` (nutricional) |
| 3 | `rotina_nao_cumprida` | gerente **e** proprietários | 23:05 SP: dia previsto sem auditoria concluída → `schedule_days.status = 'nao_cumprida'` | `rotina:YYYY-MM-DD:<unit_id>` | gerente: `/auditor/agenda?mes=YYYY-MM-01` · proprietários: `/dashboard/calendario?mes=YYYY-MM-01` |
| 4 | `pendencia_reincidente` | proprietários | pendência avaliada como não resolvida pela 2ª visita consecutiva (`pendencia_reincidente_visitas`, padrão 2) | `<pending_issue_id>` | `/dashboard/lojas/<unit_id>` |

### Textos

1. **Lembrete 8h** — título `Hoje: Auditoria Completa — Bela Vista`; corpo `Toque para abrir a agenda e iniciar`.
2. **Auditoria concluída** — título `Rodrigo concluiu Completa em Bela Vista`; corpo `Nota 83% · ⚠ falha grave` (quando houver). Nutricional: `Daniele concluiu Auditoria Nutricional em Mooca` / `Nota 93% · Excelente`.
3. **Rotina não cumprida** — título `Auditoria não registrada`; corpo `Auditoria de Imigrantes (Completa) prevista para 13/09/2026 não foi registrada`. O dia fica vermelho na agenda e no calendário do dashboard. **A loja não é penalizada** — só o indicador de rotina.
4. **Pendência reincidente** — título `Pendência reincidente`; corpo `Mooca: "Limpeza geral" segue sem solução há 2 visitas`.

## Quem dispara os tipos 1 e 3 (agendados)

A lógica está **uma vez** em TypeScript (`src/lib/cron/daily-reminder.ts`, `src/lib/cron/end-of-day.ts`) e é exposta por dois route handlers protegidos por `CRON_SECRET` (`Authorization: Bearer …` ou `?secret=…`), aceitando GET e POST:

| Rota | Cron Vercel (UTC) | SP | Parâmetros |
|---|---|---|---|
| `/api/cron/daily-reminder` | `0 11 * * *` | 08:00 | `?data=YYYY-MM-DD` (padrão hoje SP). Antes de avisar, chama `ensureSchedule` (materializa mês atual + próximo). Segunda não tem agenda → responde sem enviar. |
| `/api/cron/end-of-day` | `5 2 * * *` | 23:05 | `?data=YYYY-MM-DD`. Sem `data`: como 02:05 UTC já é o dia seguinte em SP, usa **o dia anterior quando a hora SP < 6**, senão o dia corrente (execução manual durante o dia). Se existir auditoria concluída para (unidade, tipo, data), a agenda vira `concluida` com `audit_id` e nada é enviado. |

Ambas respondem JSON com o que foi feito (`lembretes[]`, `concluidas[]`, `nao_cumpridas[]`, `enviados`, `pulados`).

**Alternativa Supabase-nativa** (mesma lógica duplicada em Deno, `supabase/functions/_shared/lib.ts`): Edge Functions `daily-reminder` e `end-of-day` + jobs pg_cron criados por `select public.schedule_notification_jobs();` (migration `0005_cron.sql`, lê `project_url` e `cron_secret` do Vault). As functions aceitam `Authorization: Bearer <CRON_SECRET>` ou a service_role key. Deploy e segredos: ver `docs/DEPLOY.md` §8.

## Testar

```bash
# lembrete de hoje (ou de uma data)
curl -H "Authorization: Bearer $CRON_SECRET" "$NEXT_PUBLIC_APP_URL/api/cron/daily-reminder?data=2026-09-25"
# verificação de um dia específico
curl -X POST -H "Authorization: Bearer $CRON_SECRET" "$NEXT_PUBLIC_APP_URL/api/cron/end-of-day?data=2026-09-25"
```

Para reenviar um aviso já registrado, apague a linha correspondente em `notifications_log` (`tipo` + `chave_dedup`).

## Requisitos no aparelho

- Ativar em **Ativar notificações** (botão no cabeçalho do app) — pede permissão e salva a subscription via `POST /api/push/subscribe`.
- iPhone: iOS 16.4+ e app **instalado na tela de início** (Safari comum não recebe push).
- Android/Chrome: funciona no navegador e no app instalado.
- Sem `NEXT_PUBLIC_VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` o servidor registra o aviso no log e não envia (`pulados`).

## Demandas (proprietário → gerente)
| Tipo | Quando | Destino | Deep link |
|---|---|---|---|
| `demanda_nova` | proprietário cria a demanda | responsável | `/auditor/demandas/[id]` |
| `demanda_comentario` | comentário de uma das partes | a outra parte | página da demanda de quem recebe |
| `demanda_concluida` | gerente conclui (relato obrigatório) | proprietários | `/dashboard/demandas/[id]` |
| `demanda_cancelada` | proprietário cancela | responsável | `/auditor/demandas/[id]` |
