# Arquitetura — Auditor da Rua

Next.js 15 (App Router, TypeScript, Tailwind v4) + Supabase (Auth, Postgres, Storage). PWA mobile-first, pt-BR, timezone `America/Sao_Paulo`.

## Pastas

| Caminho | O que é |
|---|---|
| `supabase/migrations/` | Esquema (0001), RLS (0002), seeds (0003 templates/unidades, 0004 nutricional), cron (0005) |
| `supabase/functions/` | Edge Functions (Deno) agendadas: lembrete 8h, verificação 23h |
| `src/lib/types.ts` | Tipos de domínio espelhando as tabelas |
| `src/lib/constants.ts` | Escala de notas, rótulos, pesos, faixas nutricionais |
| `src/lib/dates.ts` | Datas em `YYYY-MM-DD`, hoje em SP, formatação pt-BR |
| `src/lib/domain/scoring.ts` | Nota da auditoria do gerente (completa/simplificada/produção), bloqueios de conclusão |
| `src/lib/domain/monthly.ts` | Nota mensal ponderada, ranking, desempate, elegibilidade |
| `src/lib/domain/schedule.ts` | Rotação de 5 semanas, tipo por dia da semana |
| `src/lib/domain/nutri.ts` | Nota % binária com pesos, faixas Food Checker |
| `src/lib/supabase/{client,server,admin}.ts` | Clientes (browser / server com cookies / service_role) |
| `src/lib/auth.ts` | `requireProfile(roles?)`, `getSessionProfile()`, `homeForRole()` |
| `src/lib/data/*` | Consultas reutilizáveis (templates, unidades, auditorias, pendências, audit-flow, dashboard, nutri) |
| `src/lib/*-actions.ts` | Server actions por área (audit, nutri, dashboard, admin) e `closing.ts` (fechamento) |
| `src/lib/schedule-sync.ts` | `ensureSchedule(admin)` materializa a agenda (mês atual + próximo) |
| `src/lib/push.ts` | `sendPushToUsers(admin, ids, tipo, chaveDedup, payload)` com dedup em `notifications_log` |
| `src/components/ui/*` | Button, Card, Badge, PctBadge, ScoreBar, ProgressBar, EmptyState, PageHeader, Field/Input |
| `src/components/layout/app-shell.tsx` | Navegação por perfil (barra inferior no celular, lateral no desktop) |
| `src/app/(app)/…` | Todas as telas autenticadas (o layout aplica `requireProfile` + AppShell) |

## Rotas

| Rota | Perfil | Conteúdo |
|---|---|---|
| `/login` | — | e-mail/senha |
| `/auditor` | gerente | card "Auditoria de hoje" (Iniciar/Continuar), semana, últimos dias |
| `/auditor/agenda` | gerente | calendário mensal com status por dia |
| `/auditor/nova` | gerente | auditoria fora da agenda (escolhe unidade e tipo) |
| `/auditor/historico` | gerente | auditorias próprias |
| `/auditorias/[id]` | gerente/nutri | preenchimento (um bloco/área por tela, autosave) |
| `/auditorias/[id]/revisao` | auditor | revisão + "Concluir auditoria" |
| `/auditorias/[id]/resumo` | todos | resumo escaneável (destino do push) |
| `/nutri`, `/nutri/nova`, `/nutri/historico` | nutricionista | home, nova auditoria (escolhe loja), histórico |
| `/nutri/auditorias/[id]`, `/revisao`, `/resumo` | nutricionista (resumo: todos) | preenchimento por área, revisão, relatório da auditoria |
| `/nutri/checklists`, `/nutri/checklists/banco`, `/nutri/checklists/[unitId]` | nutri + proprietário | banco de itens + composição por unidade |
| `/dashboard` | proprietário | KPIs → ranking → produção → pendências |
| `/dashboard/lojas/[unitId]` | proprietário | drill-down da loja |
| `/dashboard/calendario` | proprietário | rotina do gerente (feito / pendente / não cumprido) + troca manual |
| `/dashboard/auditores` | proprietário | histograma de notas por auditor |
| `/dashboard/criterios` | proprietário | piores critérios recorrentes da rede |
| `/dashboard/pendencias` | proprietário | pendências em aberto na rede |
| `/dashboard/fechamento`, `/dashboard/fechamento/[mes]` | proprietário | ajustes com trilha, 99Food, "Fechar mês", relatórios |
| `/admin/unidades`, `/admin/configuracoes` | proprietário | CRUD de unidades, parâmetros |
| `/api/cron/daily-reminder`, `/api/cron/end-of-day` | `CRON_SECRET` | pushes agendados (alternativa às Edge Functions) |
| `/api/push/subscribe` | logado | salva/remove subscription |
| `/api/reports/[id]` | proprietário | download do PDF |

## Regras de escrita

- Leituras: cliente com sessão (RLS). Autosave de respostas/fotos: cliente do navegador direto no Supabase.
- Escritas sensíveis (concluir auditoria, gerar pendências, agenda, notificações, fechamento): **server action** que valida `requireProfile` e usa `createAdminClient()`.
- Auditoria concluída é imutável (trigger no banco); ajustes do proprietário vão para `owner_adjustments` e recalculam a nota via service_role.
- Nunca calcular nota fora de `lib/domain/*` — uma única implementação, testada.

## Convenções de UI

- Semáforo: 5/4 verde, 3 amarelo, 2 laranja, 1 vermelho (`SCORE_COLORS`); notas em % usam `pctTone`.
- Acento `#D59203` (`bg-brand`), headers `bg-ink`. Componentes grandes (min 44px).
- Estados vazios com `EmptyState`. Datas com `formatDatePT`/`formatDayLabelPT`.
