# Dashboard, fechamento e admin — regras de agregação

Código: `src/lib/data/dashboard.ts` (leituras), `src/lib/closing.ts` (fechamento), `src/lib/dashboard-actions.ts` e `src/lib/admin-actions.ts` (server actions), telas em `src/app/(app)/dashboard/**` e `src/app/(app)/admin/**`, widgets em `src/components/dashboard/`.

Toda nota vem de `lib/domain/*`; o dashboard só agrega em memória a partir de consultas simples (proprietário lê tudo via RLS).

## Mês e parâmetro `?mes=`

`parseMesParam` aceita `YYYY-MM` ou `YYYY-MM-DD` e normaliza para o dia 1; padrão = mês atual em São Paulo.

## `getMonthOverview(supabase, mes)`

- **Por unidade ativa**: auditorias concluídas do mês → `computeMonthlyOperational` com os pesos de `app_settings` (`peso_completa`, `peso_simplificada`); selo *amostra reduzida* usa `amostra_reduzida_min`. Nota nutricional = média das auditorias `nutricional` (`computeMonthlyNutri`) + faixa (`classifyNutri`).
- **Mês anterior**: se houver `monthly_closings`, usa `nota_operacional` fechada; senão calcula a parcial do mês anterior (marcada como "(parcial)" na tabela). Δ = nota atual − anterior, em pontos percentuais.
- **Ranking**: se o mês está fechado, as linhas vêm de `monthly_closings` (posição, elegível, premiada, empate, selos). Senão, `rankUnits` com `elegibilidade_min` das configurações. Lojas sem nota ficam em `semAuditorias` (rodapé "sem auditorias"). Produção fica em `production` (card separado).
- **Média da rede** = média simples das notas das lojas ranqueadas; mês anterior idem (fechada ou parcial).
- **Falhas graves** = nº de auditorias do gerente com `falha_grave` no mês (inclui produção).
- **Rotina cumprida**: `schedule_days` do mês com `data < hoje` ou status ≠ `prevista` (o dia de hoje só conta quando já tem resultado). Cumpridos = `concluida`; `nao_cumprida` e `prevista` no passado contam como não cumpridos.
- **Pendências** = `pending_issues` abertas na rede + quantas são `reincidente`.

## `getUnitDetail(supabase, unitId, mes)`

Auditorias do mês (todos os status), resumo mensal, fechamento (se houver), últimas 12 auditorias concluídas do gerente (gráfico de linha), decomposição por bloco (5 blocos principais; produção mostra os blocos próprios), piores itens dos últimos 3 meses (respostas agrupadas por `template_items.chave`, média da nota e nº de notas ≤ 2; top 8), pendências abertas, fotos de itens com nota ≤ 2 (URLs assinadas por 1h), auditorias nutricionais com os itens `nao_conforme` (texto da versão respondida) e `external_indicators` do mês.

## `getNetworkWorstCriteria` / `getAuditorProfile` / `getRoutineCalendar` / `getNetworkPendings`

- Critérios: respostas de todas as lojas agrupadas por `chave` do item (estável entre completa e simplificada); bloco = `bloco_ref` ou bloco do template; redação preferida = da completa. Ordena por nº de notas ≤ 2, depois menor média. Mês e últimos 3 meses.
- Auditores: histograma 1–5, N/A, nº de auditorias e média das notas finais; nutricionista mostra conforme / não conforme / N/A.
- Calendário: estado por dia — `feito` (concluida), `nao_cumprida` (status ou prevista no passado), `hoje`, `pendente`. Troca só em dia `prevista` com data ≥ hoje; grava `unit_original_id` (preserva a primeira original), `trocado_por`, `trocado_em`, `motivo_troca`.
- Pendências da rede: agrupadas por loja, reincidentes primeiro, com dias em aberto e link para a auditoria de origem.

## Fechamento (`/dashboard/fechamento/[mes]`)

1. **Indicadores 99Food** — upsert em `external_indicators` (`mes, unit_id`), `lancado_por`. Somente leitura com o mês fechado.
2. **Ajuste de pontualidade** — apenas o item `chave = 'pontualidade'` de auditorias completa/simplificada concluídas. `adjustPontualidade` grava `owner_adjustments` (valor original/novo, justificativa obrigatória, autor), altera `audit_answers.nota` e **recalcula** a auditoria com `computeAuditScore` (template + respostas + contagem de fotos), atualizando `nota_final`, `notas_blocos`, `falha_grave`, `produto_vencido`. Tudo com service_role (trigger de imutabilidade libera). Bloqueado com o mês fechado.
3. **Fechar mês** — `closeMonth(admin, mes, userId)`:
   - recusa mês futuro, mês atual antes do último dia ("O mês ainda não terminou") e mês já fechado;
   - grava uma linha em `monthly_closings` por unidade ativa (produção com `posicao_ranking = null`, não elegível) com notas, blocos, contagens, selos, posição, elegibilidade, premiada, empate e `fechado_por`;
   - chama `generateMonthlyReports(admin, mes, userId)` dentro de `try/catch`: se falhar, o fechamento permanece e a tela mostra o aviso + botão "Gerar relatórios novamente".
   - **Reabrir mês** apaga as linhas de `monthly_closings` do mês (relatórios antigos continuam listados até nova geração).

Depois de fechado, dashboard e loja mostram a nota fechada, a posição e "Loja premiada: X (R$ prêmio)" ou "Sem loja premiada este mês".

## Admin

- **Unidades** — criar/editar/ativar. Nova unidade: slug de `slugify(nome)` (sufixo numérico se repetido), `ordem_rotacao = máx + 1`, `nutri_checklist_em_revisao = true` e cópia da composição `unit_nutri_checklist` da unidade `imigrantes`. Entra na rotação nos dias ainda não gerados; "Regenerar dias futuros previstos" apaga `schedule_days` `prevista` com data > hoje e roda `ensureSchedule` (trocas manuais futuras são perdidas).
- **Configurações** — upsert de todas as chaves de `app_settings`. `nutri_compoe_ranking`/`food99_compoe_ranking` e pesos são armazenados, mas o ranking da v1 ignora (aviso na tela).
