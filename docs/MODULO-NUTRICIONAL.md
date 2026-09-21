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
