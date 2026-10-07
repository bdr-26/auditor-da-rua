# Módulo Nutricional (Daniele) — mecânica

Replica o Food Checker: checklist por **áreas físicas**, itens **binários** (Conforme / Não conforme / N/A) com peso (padrão 1), redação em **negativo** (o item descreve o problema; **Conforme = o problema NÃO foi encontrado**). Nota % = Σ pesos conformes ÷ Σ pesos aplicáveis × 100 (`lib/domain/nutri.ts`). Faixas: Excelente 91–100 · Satisfatório 80–90 · Insatisfatório 50–79 · Crítico < 50.

## Arquivos

| Caminho | Conteúdo |
|---|---|
| `src/lib/data/nutri.ts` | Consultas: auditorias nutricionais, dados de preenchimento (respostas + texto da versão + fotos + apontamentos anteriores), banco de itens, composição por unidade |
| `src/lib/nutri-actions.ts` | Server actions: iniciar / concluir / descartar auditoria; CRUD do banco; operações de composição |
| `src/components/nutri/*` | `nutri-fill` (fluxo por área com autosave), `answer-row`, `review-actions`, `new-audit-form`, `bank-manager`, `composition-editor`, `photo-gallery`, badges |
| `src/app/(app)/nutri/**` | Telas (ver rotas abaixo) |

## Rotas

| Rota | Perfil | Conteúdo |
|---|---|---|
| `/nutri` | nutri (proprietário só leitura) | "Nova auditoria", rascunhos, últimas 5 concluídas, "última auditoria há N dias" por unidade |
| `/nutri/nova` | nutri | escolhe unidade (badge "checklist em revisão") + data (padrão hoje, sem futuro) |
| `/nutri/auditorias/[id]` | nutri (dona do rascunho) | preenchimento: uma área por tela; etapa 0 = apontamentos da visita anterior (se houver) |
| `/nutri/auditorias/[id]/revisao` | nutri | bloqueios (sem resposta / NC sem apontamento / pendência sem avaliação), prévia da nota, Concluir / Descartar |
| `/nutri/auditorias/[id]/resumo` | todos | nota + classificação, pontos perdidos por grupo, apontamentos com fotos, pendências avaliadas |
| `/nutri/historico` | nutri (próprias) / proprietário (todas) | agrupado por mês, média do mês |
| `/nutri/checklists` | nutri + proprietário | unidades (ativos/pausados/áreas, "em revisão") + link para o banco |
| `/nutri/checklists/banco` | nutri + proprietário | banco central: criar, editar texto/peso/área, desativar, histórico de versões |
| `/nutri/checklists/[unitId]` | nutri + proprietário | composição da unidade por área |

## Ciclo da auditoria

1. **Iniciar** (`startNutriAudit`): se já existe rascunho (unidade, nutricional, data) reabre; se concluída, erro. Senão cria o `audits` (tipo `nutricional`, template ativo) e **pré-cria uma `audit_answers` por entrada ATIVA** da composição da unidade, congelando `nutri_entry_id`, `nutri_item_id`, `nutri_item_version_id` (versão atual do texto), `nutri_area` e `nutri_peso`. Também cria `audit_pending_reviews` para cada pendência nutricional aberta da unidade.
2. **Preencher**: o cliente do navegador atualiza `audit_answers` (`resposta`, `observacao`) diretamente (RLS: auditora + rascunho). Fila de gravação com retry (4 s, ao voltar online, botão manual); indicador "salvando… / salvo / sem conexão". Fotos: `compressImage` → fila IndexedDB (`enqueuePhoto`) → `flushQueue`/`startQueueWorker` → `audit_photos`. `audits.etapa_atual` guarda a etapa para retomar.
3. **Revisar / Concluir** (`concludeNutriAudit`): exige todos os itens respondidos, todo NC com apontamento, toda pendência avaliada e ≥ 1 item aplicável. Grava `nota_final`, `classificacao`, `notas_blocos` (uma entrada por área, peso 0), `concluida_em`. Pendências avaliadas: resolvidas → `resolvida`; mantidas → `visitas_sem_resolver + 1` e, ao atingir `pendencia_reincidente_visitas`, `reincidente` + push aos proprietários. Cada NC sem pendência aberta para a mesma entrada gera uma `pending_issues` (descrição = texto da versão usada). Push "auditoria_concluida" aos proprietários → `/resumo`.
4. **Descartar** (`discardNutriDraft`): apaga o rascunho (cascata em respostas/fotos/avaliações) e os arquivos do Storage.

## Versionamento do texto

`nutri_item_bank.descricao` é versionado por trigger: editar o texto incrementa `versao` e insere em `nutri_item_versions`. A resposta guarda `nutri_item_version_id`, então auditorias antigas continuam exibindo o texto da época. Peso e área padrão não geram versão. Desativar um item (`ativo = false`) só o esconde das listas de "incluir"; composições existentes não mudam.

## Operações de composição (`unit_nutri_checklist`)

- **Incluir do banco** em uma área existente ou nova (`addBankItemToUnit`); o mesmo item pode existir em várias áreas da mesma unidade (unique por unidade + item + área).
- **Criar item novo** (`createItemForUnit`): entra no banco com `area_padrao` = área escolhida (reaproveita item com texto idêntico) e já entra na unidade.
- **Pausar / Reativar** (`setEntryStatus`): preserva histórico; itens pausados não entram em novas auditorias.
- **Retirar** (`removeEntry`): apaga a entrada; se alguma resposta ou pendência referencia a entrada, ela é **pausada em vez de removida** (mensagem "item com histórico foi pausado em vez de removido").
- **Reordenar** (`moveEntry`, `moveArea`): renumera `ordem` dentro da área / `area_ordem` entre áreas.
- **Renomear área** (`renameArea`): atualiza todas as entradas da área na unidade.
- **Copiar composição** (`copyComposition`): adiciona só o que ainda não existe na unidade de destino, mantendo áreas e ordens.
- **Checklist em revisão** (`setUnitRevisao`): flag `units.nutri_checklist_em_revisao`, visível em `/nutri/nova`; nutri ou proprietário limpa após validar (escrita via service_role porque a RLS de `units` só libera o proprietário).

## Equipe nutri, agenda, controles e assinatura (migrations 0010 e 0011)

**Níveis.** `profiles.nutri_nivel`: `chefe` (Daniele) ou `estagiaria`. A chefe vê e edita tudo do módulo (auditorias das estagiárias, controles, agenda) via `is_nutri_chefe()`/`can_manage_audit()` nas políticas; a estagiária só o que é dela. Logins são criados pelo proprietário em `/admin/usuarios` (`src/lib/users-actions.ts`, `auth.admin.createUser`).

**Início (`/nutri`).** Chefe/proprietário: painel da equipe (auditorias e controles do mês por pessoa, média, última visita, rascunhos e tarefas atrasadas), rascunhos em andamento, conferência dos controles (unidade × tipo, finalizados no mês), agenda de hoje/atrasadas, unidades e últimas auditorias (`src/lib/data/nutri-equipe.ts`). Estagiária: tarefas de hoje com atalhos, rascunhos para continuar, nova auditoria/controle.

**Agenda (`/nutri/agenda`).** `nutri_agenda` (data, responsável, unidade, tipo auditoria/controles/outro, descrição, status). A chefe programa (push "Agenda dd/mm · unidade" para a responsável); a responsável conclui; a chefe cancela/reabre/exclui. Ao concluir uma auditoria nutricional, a tarefa prevista da mesma responsável/unidade/data vira concluída automaticamente.

**Controles (`/nutri/controles`).** Planilhas digitais definidas em código (`src/lib/nutri/controle-tipos.ts`): temperatura de equipamentos, distribuição, óleo, recebimento, transportados, hortifrúti (PPM) e manutenção. Cada tipo tem cabeçalho, linhas fixas/livres e campos com faixa (alerta "fora da faixa"). Registro em `nutri_controles` (`dados` JSONB `{cabecalho, linhas}`), `rascunho` → `finalizado` (obrigatórios preenchidos e ≥ 1 linha); só a chefe edita/reabre um finalizado. PDF por controle (`/api/nutri/controles/[id]/pdf`) e compilação mensal por unidade e tipo (`/api/nutri/controles/relatorio?unit=&tipo=&mes=YYYY-MM`), ambos com link de 7 dias para WhatsApp (POST). Para incluir um novo tipo de planilha, acrescente uma entrada em `CONTROLE_TIPOS`.

**Assinatura do supervisor.** Em auditorias concluídas (gerente e nutri), `SignaturePad` colhe nome, CPF, cargo e a assinatura desenhada (PNG em `audit-photos/assinaturas/<id>.png`, colunas `assinatura_*` em `audits`); o PDF mostra a assinatura no lugar da linha "Responsável da unidade".

## Rotina da operação, Café da Rua e assinatura dupla (migration 0012)

**Unidade só da nutrição.** `units.somente_nutri` (Café da Rua, seed na 0012 com checklist clonado de Imigrantes + item das etiquetas das produções de Moema). Fica fora da auditoria, rotação e ranking do gerente (`getUnits(..., { gerente: true })`, `schedule-sync`, `audit-actions`, troca de loja na rotina, listas de "lojas" do dashboard/fechamento); a nutrição usa normalmente. Marcada em Admin → Unidades ("Só nutrição").

**Rotina padrão (`/nutri/agenda/rotina`).** `nutri_rotinas` (unidade, responsável, tipo, `frequencia` semanal com `dias_semana` 0–6 ou mensal com `dia_mes` 1–28, descrição, ativa). `materializeNutriRotinas(admin, from, to)` (`src/lib/nutri/rotinas-sync.ts`) cria as tarefas em `nutri_agenda` com `rotina_id` (índice único `rotina_id + data`, idempotente), pulando unidades inativas/em abertura e responsáveis inativas. Roda no cron das 8h (30 dias à frente) e no botão "Gerar agenda"; salvar/pausar/excluir uma rotina refaz as tarefas futuras ainda previstas. O cron também manda push "Hoje: …" para cada responsável com tarefas do dia (`nutri` no JSON do `/api/cron/daily-reminder`).

**Por item não conforme.** `audit_answers.corrigido_na_hora` e `orientacao` (quem foi orientado e o quê), salvos pelo autosave do preenchimento; aparecem no resumo e no PDF (chip "corrigido na hora", linha "Orientação"). A pendência criada para a próxima visita recebe "(corrigido na hora)" na observação de origem.

**Assinatura dupla.** `SignaturePad papel="auditor"` (equipe de qualidade, CPF opcional, colunas `assinatura_auditor_*` / `assinada_auditor_em`, PNG em `assinaturas/<id>-auditor.png`) + `papel="supervisor"` (como antes). O PDF nutricional mostra as duas caixas assinadas (`assinaturaAuditor` à esquerda).

**Controles novos.** `amostras` (coleta de amostras, só Moema), `conferencia_planilhas` (visita semanal: situação de cada planilha preenchida pelos funcionários, dias faltantes, orientação) e `pasta_documentacao` (documentos com situação e vencimento; vencido/ausente em vermelho).
