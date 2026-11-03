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

1. **Indicadores do mês por loja** — upsert em `external_indicators` (`mes, unit_id`), `lancado_por`: nota 99Food, cancelamentos, tempo médio, **pedidos** (nº de pedidos do mês) e **recado** (texto do proprietário para a loja, até 600 caracteres). Informativos — não compõem a nota, mas saem no relatório do supervisor. Somente leitura com o mês fechado.
   - **Importar relatório da 99** (`Importador99`, dentro do formulário): o proprietário escolhe o arquivo "Dados do pedido" exportado da 99 (xlsx, um pedido por linha). O arquivo é lido **no navegador** (SheetJS, `import("xlsx")` sob demanda; nada sobe para o servidor) por `src/lib/indicadores-99.ts`: `parsePedidos99` (colunas por nome, sem acento) → `resumirImportacao99` agrupa por unidade pelo mapa fixo de lojas da 99 (ids conhecidos + nome: "Bela Vista", "Imigrantes", "Mooca", "Moema"; "Smash da Rua" sem bairro = Moema Delivery) → prévia por loja (pedidos, cancelamentos, nota, tempo, dias, atraso) com aviso de pedidos fora do mês e seletor para lojas não reconhecidas → "Usar estes números" preenche as linhas. "Salvar indicadores" grava os quatro campos mais `detalhe_99` (jsonb `Detalhe99`), `importado_99_em` e `arquivo_99`.
   - Regras: **pedidos** = concluídos; **nota** = média de "Nível de avaliação do cliente" ÷ 100; **tempo médio** = média de "Tempo de finalização do pedido" (pedido → conclusão), em minutos.
   - **Cancelamentos** são classificados (`classificarCancelamento`) pelo tempo entre "Horário do pedido" e "Horário do cancelamento" e pelo aceite ("Tempo para aceitação" > 0 ou clicou em "Pronto"): **desistência** (< 1 min sem aceite: cliente refez o pedido / pagamento; fica FORA do número), **não aceito** (sem aceite ≥ 1 min ou motivo "não confirmou no prazo": cancelamento automático da 99, venda perdida pela loja), **loja** (motivo da loja ou responsável = loja), **após o aceite** (por responsável). `cancelamentos` = não aceitos + loja + após o aceite; `cancel_pct` e `nao_aceitos_pct` sobre concluídos + cancelados. Em out/2026, 61% das linhas canceladas eram desistências e 30% não aceitos. O detalhe guarda ainda cancelamentos por responsável e motivo da loja, distribuição de estrelas, tags positivas/negativas (por nota ≤ 3 ou ≥ 4), até 8 comentários negativos, preparação atrasada, itens em falta, clientes novos e tempos de preparo/entrega/aceite.
2. **Ajuste de pontualidade** — apenas o item `chave = 'pontualidade'` de auditorias completa/simplificada concluídas. `adjustPontualidade` grava `owner_adjustments` (valor original/novo, justificativa obrigatória, autor), altera `audit_answers.nota` e **recalcula** a auditoria com `computeAuditScore` (template + respostas + contagem de fotos), atualizando `nota_final`, `notas_blocos`, `falha_grave`, `produto_vencido`. Tudo com service_role (trigger de imutabilidade libera). Bloqueado com o mês fechado.
3. **Fechar mês** — `closeMonth(admin, mes, userId)`:
   - recusa mês futuro, mês atual antes do último dia ("O mês ainda não terminou") e mês já fechado;
   - grava uma linha em `monthly_closings` por unidade ativa (produção com `posicao_ranking = null`, não elegível) com notas, blocos, contagens, selos, posição, elegibilidade, premiada, empate e `fechado_por`;
   - chama `generateMonthlyReports(admin, mes, userId)` dentro de `try/catch`: se falhar, o fechamento permanece e a tela mostra o aviso + botão "Gerar relatórios novamente".
   - **Reabrir mês** apaga as linhas de `monthly_closings` do mês (relatórios antigos continuam listados até nova geração).

Depois de fechado, dashboard e loja mostram a nota fechada, a posição e "Loja premiada: X (R$ prêmio)" ou "Sem loja premiada este mês".

### Relatório mensal por loja para o grupo dos supervisores

Na virada do mês o proprietário envia **um PDF por loja** ao grupo de WhatsApp dos supervisores. O relatório (`src/lib/reports/loja-report.tsx`, dados em `buildMonthlyReportData`) traz, nesta ordem:

1. Nota do mês, posição no ranking, mês anterior e nº de auditorias (+ selos: falha grave, produto vencido, amostra reduzida, premiada).
2. **Resumo do mês para o supervisor** — bullets em linguagem simples: nota e variação, auditorias, onde acertaram (itens com média 5), prioridades (3 piores médias), recorrências, pendências, nutrição e delivery (pedidos, nota 99Food, cancelamentos, tempo). Abaixo, o **Recado da direção** (campo `recado` dos indicadores), se preenchido.
3. **Pontos de atenção** — do mais grave para o menos: falhas graves (com os itens), produto vencido, bloco zerado, pendências reincidentes, itens recorrentes, queda da nota ≥ 5 pts, bloco com queda ≥ 10 pts, nutrição Regular/Insatisfatório, pendências abertas, nota 99Food < 4,5, cancelamentos ≥ 2% dos pedidos, amostra reduzida. Sem nada disso: selo "SEM PONTOS CRÍTICOS".
4. Decomposição por bloco · O que está bom · O que manter · O que melhorar (iguais ao relatório anterior).
5. **O que é recorrente** — itens com média ≤ 3 neste mês **e** no mês anterior (`recorrentes`: média dos dois meses e nº de notas 1–3).
6. **Pendências em aberto** — `pending_issues` com `status = 'aberta'` da unidade (gerente e nutrição), com data da auditoria de origem, visitas sem resolver e selo reincidente.
7. Apontamentos (nota 1–2 com fotos) · Nutrição (bloco "O que mais se repete": não conformidades agrupadas por item do banco via `agruparNutriNc` em `src/lib/reports/nutri-recorrencia.ts` — o mesmo item em áreas/visitas diferentes conta junto; mostra vezes, visitas em que apareceu, áreas, ocorrências no mês anterior e corrigidas na hora; em laranja quando apareceu em metade ou mais das visitas ou 3+ vezes, e esses entram nos pontos de atenção; depois, a lista completa por visita) · **Delivery e indicadores 99Food** (pedidos, nota, cancelamentos, tempo; com o relatório da 99 importado, também distribuição de estrelas, elogios, atrasos, itens em falta, clientes novos, cancelamentos por responsável/motivo e o que os clientes reclamaram) · Auditorias do mês · assinatura do supervisor. Com o detalhe da 99, os pontos de atenção ganham: não aceitos no prazo ≥ 2%, cancelamentos ≥ 5% (sem desistências), cancelamentos pela loja (com motivos), preparação atrasada ≥ 5%, avaliações de 1–3 estrelas ≥ 10% (com as tags) e itens em falta.

**Versão resumida (uma página)** — `src/lib/reports/loja-resumo-report.tsx`, a que vai para o grupo dos supervisores (padrão dos botões de compartilhar). Mesmos dados (`LojaReportData`), só o essencial: 4 KPIs (nota e variação, ranking/selos, nutrição, 99Food), "O que precisa de ação este mês" (até 5 pontos, os mais graves), bloco **AUDITORIA DO GERENTE** (onde acertou × o que melhorar, até 4 itens cada, "2º mês" nos recorrentes, pendências em aberto), bloco **AUDITORIA DA NUTRIÇÃO** (nota, classificação, variação e as não conformidades **agrupadas por item** — "o que mais se repete", até 4), bloco **DELIVERY · 99FOOD** (pedidos, nota, não aceitos, cancelados, tempo, atrasos, reclamações) e o recado da direção. A versão completa continua disponível (`?versao=completo`).

Onde gerar/compartilhar (`LojaReportLinks` → `ShareReport`, folha de compartilhamento do celular ou link assinado de 7 dias; o link "Abrir relatório completo" abaixo de cada loja abre a versão completa):

- `/dashboard/fechamento/[mes]` — card "Relatório por loja — grupo dos supervisores", com todas as lojas ranqueadas + Moema Produção, antes e depois do fechamento;
- `/dashboard/lojas/[unitId]` e `/dashboard/auditorias?loja=…` — a loja selecionada.

Rota `GET/POST /api/reports/loja?unit=<id>&mes=YYYY-MM[&versao=completo]` (proprietário e gerente): gera o PDF na hora (resumo por padrão) com `buildMonthlyReportData(admin, mes, { unitIds: [unit] })` — **oficial** quando o mês tem `monthly_closings` (mesmos números do fechamento), **PRÉVIA** enquanto está aberto (marca d'água no cabeçalho e no nome do arquivo). O `POST` guarda em `reports/loja/<unit>/<mes>.pdf` e devolve o link assinado. Os PDFs gerados no fechamento (`generateMonthlyReports`) usam o mesmo documento.

Lembrete: no dia 1 de cada mês o cron das 8h envia push aos proprietários ("Virada de mês: relatórios de <mês>", dedup `virada:<mês>`) apontando para o fechamento do mês anterior.

## Admin

- **Unidades** — criar/editar/ativar. Nova unidade: slug de `slugify(nome)` (sufixo numérico se repetido), `ordem_rotacao = máx + 1`, `nutri_checklist_em_revisao = true` e cópia da composição `unit_nutri_checklist` da unidade `imigrantes`. Entra na rotação nos dias ainda não gerados; "Regenerar dias futuros previstos" apaga `schedule_days` `prevista` com data > hoje e roda `ensureSchedule` (trocas manuais futuras são perdidas).
- **Configurações** — upsert de todas as chaves de `app_settings`. `nutri_compoe_ranking`/`food99_compoe_ranking` e pesos são armazenados, mas o ranking da v1 ignora (aviso na tela).

## Calendário da rotina: edição

`RoutineCalendar` (cliente) + ações em `src/lib/dashboard-actions.ts`:

| Ação | Regra |
|---|---|
| `swapScheduleDay` (trocar a loja do dia) | dia previsto, de hoje em diante, sem auditoria; motivo obrigatório; grava `unit_original_id`, `trocado_por`, `motivo_troca` |
| `swapScheduleUnits` (trocar com outro dia; arrastar e soltar) | os dois dias previstos, futuros, sem auditoria; produção só com produção |
| `moveScheduleDay` (mover para dia vazio/sem visita) | destino sem linha; tipo recalculado pelo dia da semana; origem vira "sem visita" (`auditor_days_off`, motivo "Movida para …") |
| `addScheduleDay` (incluir visita) | data futura sem linha; remove folga/"sem visita" da data; `auditor_id` = gerente ativo |
| `removeScheduleDay` (remover visita) | qualquer dia sem auditoria registrada, inclusive passados "não cumpridos"; registra `auditor_days_off` (motivo) para a agenda não regerar |
| `clearMissedDays` (banner "Remover da rotina") | todos os dias passados do mês sem auditoria |
| `removeDayOff` (devolver à rotação) | apaga a folga/"sem visita" e regera o dia |

No celular o painel do dia é uma folha inferior acima da barra de navegação (área segura); no desktop, painel lateral com arrastar e soltar entre células.

## Auditorias (`/dashboard/auditorias`)

Listagem de todas as auditorias do mês para o proprietário, em dois blocos (gerente e nutrição), com filtro por mês (últimos 12) e por unidade. Cada item mostra dia, unidade, tipo, quem fez e a nota (PctBadge para o gerente; nota + classificação para a nutrição), com "Abrir" (resumo) e `ShareReport` compacto (compartilhar por link, abrir/imprimir, baixar). Rascunhos aparecem sem nota e sem PDF. Dados: `getMonthAudits(..., { status: "todas" })`.
