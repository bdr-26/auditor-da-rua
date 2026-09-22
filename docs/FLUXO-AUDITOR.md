# Fluxo do gerente (Rodrigo) — home, agenda, preenchimento e conclusão

Escopo: `src/app/(app)/auditor/**`, `src/app/(app)/auditorias/**`, `src/components/audit/**`, `src/lib/audit-actions.ts`, `src/lib/data/audit-flow.ts`.

## Telas

| Rota | O que faz |
|---|---|
| `/auditor` | Materializa a agenda (`ensureSchedule`, mês atual + próximo), mostra o card "Auditoria de hoje" (Iniciar / Continuar com badge *rascunho* / Ver resumo), a semana ter–dom (`workWeekRange`) e os últimos 7 dias com chip de status. Dia `nao_cumprida` aparece em vermelho mas ainda permite iniciar no mesmo dia. |
| `/auditor/nova` | "Auditoria fora da agenda": unidade + tipo (+ data, hoje por padrão). Produção só para a cozinha central; simplificada/completa só para lojas. |
| `/auditor/agenda?mes=YYYY-MM-01` | Calendário seg–dom. Célula = unidade abreviada + tipo, cor por estado (concluída verde, prevista cinza, hoje amarelo, rascunho amarelo-claro, não cumprida vermelho). Clique: rascunho → preenchimento, concluída → resumo, hoje sem auditoria → inicia. Auditorias fora da agenda aparecem como "extra". |
| `/auditor/historico` | Auditorias próprias agrupadas por mês, com nota, status e link. |
| `/auditorias/[id]` | Preenchimento (rascunho, só o auditor dono). Concluída ou aberta por outro perfil → redireciona para o resumo. Nutricional → `/nutri/auditorias/[id]`. `?etapa=N` força a etapa (usado pela revisão). |
| `/auditorias/[id]/revisao` | Lista o que falta por etapa (sem resposta, 1–2 sem foto, 1–2 sem observação, pendências sem avaliação), prévia da nota com barras por bloco, faixa de falha grave, "Concluir auditoria" e "Descartar rascunho". |
| `/auditorias/[id]/resumo` | Resumo escaneável para qualquer perfil (RLS decide quem vê): nota grande + classificação, faixa vermelha de falha grave / produto vencido, barras dos blocos, itens ≤ 3 com foto e observação, pendências avaliadas. Rascunho mostra progresso em vez de nota. Nutricional → `/nutri/auditorias/[id]/resumo`. |

## Etapas do preenchimento (`components/audit/steps.ts`)

- Etapa 0 é sempre **Pendências da visita anterior**: cada `audit_pending_reviews` da auditoria com botões *Resolvida* / *Mantida* (+ observação opcional) e, abaixo, o item `pendencias=true` do template pontuado 1–5.
  - Sem pendências: mensagem "Nenhuma pendência…" e o item de pendências é gravado como **N/A automaticamente** no primeiro carregamento.
- Completa: uma etapa por bloco com `peso > 0`, na ordem do template (o bloco `pendencias`, peso 0, vive na etapa 0).
- Simplificada / Produção: etapa 0 (pendências) + uma etapa com o bloco único sem o item de pendências.
- Cabeçalho fixo: unidade, tipo, barra de progresso e contador `respondidos/total` calculados no client com `computeAuditScore` (função pura, mesma do servidor). Rodapé fixo: Anterior / Próximo / Revisar.
- Item: 5 botões grandes (cores `SCORE_COLORS`, rótulos `SCORE_LABELS`), N/A, tag ⚠ *Falha grave*. Nota ≤ 2 abre câmera (`capture="environment"`, múltiplas) + observação obrigatória; nota 3–5 tem observação opcional recolhida. Item `produto_vencido` com nota 1 mostra o checkbox "Havia produto vencido em uso" (marcado por padrão).
- `etapa_atual` é gravada a cada troca de etapa; reabrir retoma na mesma etapa.

## Autosave (client → Supabase, RLS)

Tudo que o auditor toca é gravado na hora pelo cliente do navegador (`lib/supabase/client`), sem server action:

- **Fila por chave** (`ans:<item>`, `pend:<pendência>`, `photo:<id>`, `etapa`): cada chave guarda só o último estado; um *pump* por chave executa e, em erro, espera 3 s e tenta de novo indefinidamente. Indicador no cabeçalho: *salvando… / salvo / sem conexão — tentando novamente*. `beforeunload` avisa se algo ainda não subiu.
- **Respostas** (`audit_answers`): o id da resposta é gerado no client (`crypto.randomUUID()`) no primeiro toque e o write é `upsert` pela **chave primária**. Motivo: o índice único `(audit_id, item_id)` é parcial (`where item_id is not null`) e o PostgREST não consegue inferi-lo em `on_conflict=audit_id,item_id`. Se outra aba já criou a linha do item (erro `23505`), o client adota o id existente e faz `update`.
- **Pendências** (`audit_pending_reviews`): `upsert` com `onConflict: "audit_id,pending_issue_id"` (constraint real).
- **Fotos**: `compressImage` (≈1600 px JPEG) → `enqueuePhoto` na fila IndexedDB com `path = <audit_id>/<answer_id>/<uuid>.jpg` → `flushQueue` imediato + `startQueueWorker` (reenvia ao voltar online e a cada 15 s). Como o id da resposta já é conhecido no client, a foto entra na fila mesmo antes de a resposta subir; o upload só é registrado em `audit_photos` quando a FK existe (retry cuida disso). Miniaturas usam object URL para fotos da sessão e URL assinada (`createSignedUrls`) para as já enviadas. Remover foto: apaga `audit_photos` + objeto do bucket; foto ainda na fila é marcada e apagada assim que o upload concluir. Fotos da fila de sessões anteriores são reexibidas ao reabrir a auditoria.
- Observações têm debounce de 600 ms; notas e N/A gravam imediatamente (UI otimista).

## Server actions (`lib/audit-actions.ts`, `requireProfile(["auditor_geral"])` + `createAdminClient()`)

- `startAudit({ unitId, tipo, data? })` — data padrão `todaySP()`. Valida tipo × unidade. Se já existe auditoria (unidade, tipo, data): rascunho meu → reabre; concluída ou de outro auditor → erro. Senão cria o rascunho (template ativo do tipo, `etapa_atual 0`) e uma `audit_pending_reviews` para cada pendência aberta da unidade com `item_id` (origem gerente). Vincula `schedule_days` da mesma data/unidade/tipo (`audit_id`, `auditor_id`). Redireciona para `/auditorias/[id]`.
- `concludeAudit(auditId)` — auditoria minha e em rascunho. Recalcula com `computeAuditScore`; bloqueia se `concludeBlockers` não estiver vazio ou se alguma pendência estiver sem avaliação. Depois, com service_role:
  1. `audits`: `status concluida`, `nota_final`, `notas_blocos`, `falha_grave`, `produto_vencido`, `concluida_em`.
  2. Pendências avaliadas: *resolvida* → `status resolvida`, `resolvida_em_audit_id`, `resolvida_em`; *mantida* → `visitas_sem_resolver + 1`; ao atingir `pendencia_reincidente_visitas` (settings) e ainda não reincidente → `reincidente=true`, `reincidente_notificado_em` e push `pendencia_reincidente` aos proprietários (dedup pelo id da pendência).
  3. Novas pendências para cada item com nota 1–2 (exceto o item de pendências), com snapshot da descrição, nota e observação — sem duplicar se já houver pendência aberta do mesmo item na unidade (a antiga já foi incrementada).
  4. `schedule_days` (data, unidade, tipo) → `concluida` + `audit_id`.
  5. Push `auditoria_concluida` aos proprietários (dedup por `auditId`), com nota e "⚠ falha grave" quando houver, deep link para o resumo. Falha de push nunca impede a conclusão.
  6. `revalidatePath` das rotas do auditor/dashboard e `redirect` para o resumo.
- `deleteDraft(auditId)` — descarta rascunho próprio: remove objetos do bucket, desvincula a agenda e apaga a auditoria (cascade em respostas/fotos/avaliações).

## Regras de conclusão (resumo)

- Todo item respondido (nota ou N/A); nota 1–2 com ≥ 1 foto e observação; toda pendência avaliada; pelo menos um item aplicável.
- Falha grave (item ⚠ com nota 1) zera o bloco (completa) ou zera os itens ⚠ (simplificada/produção) e limita a nota a 50%; a revisão e o resumo mostram a "nota sem teto" para transparência.
- Concluída é imutável (trigger no banco); ajustes só via `owner_adjustments`.

## Auditoria surpresa (proprietários)

Os proprietários podem iniciar, em `/dashboard/surpresa` (ou pelo atalho na página da unidade), uma auditoria completa/simplificada/produção a qualquer momento. É o mesmo fluxo de preenchimento, revisão e conclusão do gerente (`startAudit`, `concludeAudit`, `deleteDraft` aceitam `proprietario`), com a mesma nota e as mesmas pendências. Diferenças:

- Não vincula nem conclui a linha da agenda do gerente: a rotina dele continua devida.
- Pode coexistir com a auditoria do gerente na mesma unidade/tipo/dia (a unicidade em `audits` passou a ser `(unit_id, tipo, data, auditor_id)` na migration 0008).
- Entra normalmente na nota mensal, no ranking e nos relatórios (as agregações filtram por unidade/tipo/status, não por auditor). O push de conclusão avisa os outros proprietários com o sufixo "(surpresa)".

## Orientações por item ("O que conferir")

Cada item das auditorias completa, simplificada e de produção tem um texto de orientação em `src/lib/audit-guidance.ts`, indexado pela `chave` do item do template (a mesma chave vale nos três templates, ex.: `temperaturas`). O cartão de pontuação (`ScoreItem`) mostra um botão "O que conferir" que abre a lista do que verificar e a régua de notas 5 / 3 / 1. Para alterar um texto, edite o arquivo; itens novos sem entrada no mapa simplesmente não mostram o botão.
