# AUDITOR DA RUA — Especificação de negócio (v1)

> Regras validadas com os proprietários. `[ASSUMIDO]` = decisão padrão ajustável.

## 1. Objetivo
Sistema de auditoria multilojas do grupo Burger da Rua (São Paulo). Gerente geral (Rodrigo) e nutricionista (Daniele) auditam as unidades em rotinas fixas; o app gera notas por critério, ranqueia as lojas mensalmente e dá aos proprietários (Antonio e Victor) um dashboard de performance das lojas e de cumprimento da rotina dos auditores.

Princípios: input rápido no celular dentro da loja; nenhum lançamento se perde (rascunho com autosave); nota transparente e rastreável até os itens; sem plano de ação complexo (não conformidade vira "ponto de atenção" que reaparece na próxima visita).

## 2. Stack
Next.js (App Router) + Supabase (Auth, Postgres, Storage, Edge Functions p/ cron). PWA mobile-first instalável (sem offline). Web Push. Desktop responsivo. Timezone `America/Sao_Paulo`, pt-BR.

## 3. Perfis
| Perfil | Quem | Pode |
|---|---|---|
| `auditor_geral` | Rodrigo | Auditorias simplificada, completa, produção; agenda; histórico próprio |
| `auditor_nutricao` | Daniele | Auditorias nutricionais; histórico próprio; edita checklists nutricionais |
| `proprietario` | Antonio e Victor | Dashboard (leitura), ajuste de nota no fechamento (com trilha), 99Food, fechamento, relatórios, CRUD de unidades. Não editam auditorias dos auditores. |

Login e-mail/senha (Supabase Auth), sem cadastro aberto. Supervisores de loja não têm acesso (recebem só o PDF mensal). Ajuste de proprietário grava quem, quando, valor original, valor novo, justificativa obrigatória.

## 4. Unidades
Ranqueadas: Moema Salão, Moema Delivery, Imigrantes, Bela Vista, Mooca. Fora do ranking: Moema Produção (cozinha central; nota mensal própria em card separado). Moema Salão e Delivery têm o mesmo endereço mas são auditadas separadamente. CRUD aberto ao proprietário; novas lojas entram na rotação e no ranking.

## 5. Rotina do gerente (agenda rotativa)
Semana ter–dom (segunda folga fixa). Além disso, o gerente folga **1 domingo por mês**, escolhido pelo proprietário no calendário da rotina (antes ou depois de gerar a agenda): esse domingo sai da rotação (a loja daquele dia não é visitada nessa semana), não gera lembrete nem conta no indicador de rotina. Terça: Produção (Moema Produção, fixo). Qua/Qui: Simplificada (1 loja rotativa). Sex/Sáb/Dom: Completa (1 loja rotativa).
Rotação: as 5 lojas ocupam as 5 posições (qua–dom) e a escala desliza 1 posição por semana; ciclo de 5 semanas, cada loja 1x em cada dia.

| Semana | Qua | Qui | Sex | Sáb | Dom |
|---|---|---|---|---|---|
| 1 | Moema S | Moema D | Imigrantes | Bela Vista | Mooca |
| 2 | Mooca | Moema S | Moema D | Imigrantes | Bela Vista |
| 3 | Bela Vista | Mooca | Moema S | Moema D | Imigrantes |
| 4 | Imigrantes | Bela Vista | Mooca | Moema S | Moema D |
| 5 | Moema D | Imigrantes | Bela Vista | Mooca | Moema S |

App gera a agenda (mês atual + próximo) com calendário para o Rodrigo. Proprietário pode trocar a loja de um dia (troca registrada). Cada loja recebe 4–5 auditorias/mês (2–3 completas).

## 6. Escala de nota (gerente)
| Nota | Nome | Significado |
|---|---|---|
| 5 | Padrão DA RUA | Impecável, referência |
| 4 | Conforme | Dentro do padrão |
| 3 | Atenção | Funciona, desvios visíveis |
| 2 | Não conforme | Fora do padrão, exige correção |
| 1 | Crítico | Falha grave ⚠ |

Botões grandes (1 toque), cores 5/4 verde, 3 amarelo, 2 laranja, 1 vermelho. Nenhum item pré-preenchido; contador "14/21 itens". Notas 1 e 2 exigem foto (câmera, `capture`, comprimida no client ~1600px JPEG) + observação; app bloqueia conclusão sem foto. Notas 3–5: observação opcional. Item pode ser N/A (sai do cálculo). Rascunho com autosave a cada resposta; tela de revisão antes de concluir. 1 auditoria por unidade/tipo/dia (constraint).

## 7. Auditoria Completa (sex/sáb/dom) — 5 blocos, 20% cada
Nota do bloco = média dos itens aplicáveis em % (`(média − 1) / 4 × 100`). Nota = média dos 5 blocos.

Bloco 1 — Segurança Alimentar ⚠: todos falha grave; item nota 1 zera o bloco (0%) e limita a nota da auditoria a 50%. Itens: temperatura quente/frio; validade e PVPS (nota 1 por produto vencido em uso → loja inelegível à premiação no mês); armazenamento e identificação; EPIs; higienização de utensílios/equipamentos.
Bloco 2 — Operação e Produto: montagem e peso (ficha técnica); ponto da carne; tempo de preparo/entrega; mise en place; desperdício.
Bloco 3 — Limpeza e Estrutura: limpeza geral; descarte de resíduos e óleo; equipamentos/manutenção; apresentação da loja.
Bloco 4 — Atendimento e Delivery: atendimento; embalagem/expedição; operação no app de delivery.
Bloco 5 — Equipe e Gestão: uniforme; pontualidade/escala; planilhas; ambiente de trabalho.

## 8. Auditoria Simplificada (qua/qui) — 12 itens
Temperaturas ⚠; Validades e PVPS ⚠; Limpeza geral; Montagem e ponto; Tempo de preparo; Uniforme; Escala cumprida; Mise en place; Equipamentos; Descarte; Planilhas do dia; Pendências da visita anterior resolvidas (app lista itens 1–2 da última auditoria da loja).
Nota = média dos itens aplicáveis em %. Falha grave (⚠ nota 1): itens ⚠ contam 0% e teto 50%. O item de pendências também existe na completa como etapa inicial.

## 9. Auditoria de Produção (terça) — Moema Produção
Recebimento; Armazenamento ⚠; Produção conforme ficha; Validades e PVPS ⚠; Higienização ⚠; Expedição; Limpeza geral; Planilhas de produção; Pendências da visita anterior. Nota mensal = média das terças. Card separado, fora do ranking.

## 10. Módulo Nutricional (Daniele)
Replica o Food Checker. Banco de itens central + composição por unidade (incluir, retirar, pausar/reativar preservando histórico, reordenar). Item novo entra no banco. Editar texto gera nova versão (auditorias antigas mantêm o texto). CRUD para proprietário e Daniele.
Checklist por áreas físicas; itens binários Conforme / Não Conforme / N/A com peso (todos 1). Redação em NEGATIVO (item descreve o problema): Conforme = problema não existe. Não conforme abre apontamento em texto + foto opcional.
Nota % = Σ pesos conformes ÷ Σ pesos aplicáveis × 100. Faixas: Excelente 91–100; Satisfatório 80–90; Insatisfatório 50–79; Crítico < 50. Relatório: nota + classificação, pontos perdidos por grupo, apontamentos.
Sem agenda fixa; dashboard mostra frequência real. Nota nutricional mensal = média das auditorias dela; exibida ao lado da operacional, sem compor o ranking (flag `nutri_compoe_ranking`). Seeds: Anexos A (Moema Salão), B (Moema Delivery), C (Imigrantes, "em revisão"; Bela Vista e Mooca clonam).

## 11. Notas, ranking e premiação
Nota mensal operacional = Σ(nota × peso) ÷ Σ(pesos): completa peso 2, simplificada peso 1. Auditoria conta no mês da sua data. Dia não cumprido NÃO penaliza a loja (penaliza o indicador de rotina). Nota exibe nº de auditorias; < 3 → selo "amostra reduzida". Desempate: 1º maior nota em Segurança Alimentar; 2º menor nº de falhas graves; depois empate declarado (prêmio dividido).
Ajuste do proprietário no fechamento: só a componente pontualidade/escala (Control iD), com justificativa e trilha. "Fechar mês" congela notas, calcula ranking e libera relatórios.
Prêmio R$ 200 ao supervisor da 1ª colocada; elegibilidade nota ≥ 70% ("sem loja premiada este mês" caso contrário); flag de produto vencido = inelegível. Sem vínculo com bonificações existentes.
Indicadores 99Food (1x/mês no fechamento, por loja): nota média, cancelamentos, tempo médio de entrega. Informativo, não compõe a nota (parametrizável).

## 12. Notificações (Web Push com deep link)
1. Rodrigo, 8h (ter–dom): "Hoje: [tipo] — [unidade]" → agenda com botão Iniciar.
2. Proprietários, a cada auditoria concluída: "[Auditor] concluiu [tipo] em [unidade] — nota X%" → resumo.
3. Rotina não cumprida (23h): notificar Rodrigo e proprietários; dia em vermelho.
4. Pendência reincidente (2 visitas sem resolver): push aos proprietários + destaque no dashboard.

## 13. Dashboard dos proprietários
Nível 1 — 4 KPIs: Líder do mês; Média da rede (Δ vs. mês anterior); Falhas graves (vermelho se > 0); Rotina cumprida ("17/19 dias · 89%", frequência da Daniele ao lado).
Nível 2 — Ranking: posição, nome, nota parcial, nota fechada mês anterior, Δ com seta, nº auditorias, selos (falha grave / inelegível / amostra reduzida), nota nutricional; linha → página da loja. Abaixo: card Moema Produção e "Pendências em aberto na rede".
Nível 3 — Página da loja: nota parcial/fechada, decomposição por bloco, evolução (linha), piores itens recorrentes, pendências, fotos de não conformidade, apontamentos nutricionais, 99Food, lista de auditorias.
Auxiliares: piores critérios da rede; calendário da rotina do Rodrigo; perfil do auditor (histograma 1–5).
Resumo da auditoria (destino do push): nota + tipo + loja, 5 barras, itens ≤ 3 com foto/observação, pendências avaliadas.

## 14. Relatórios PDF (fechamento)
1. Mensal por loja (supervisor): nota e posição, comparativo, blocos, o que está bom / manter / melhorar (itens 5 / 4 / ≤3), apontamentos com fotos, nota nutricional e apontamentos, assinatura.
2. Consolidado do grupo: 6 unidades — ranking, notas, comparativos, falhas graves, rotina dos auditores, 99Food.
Server-side, armazenados no Storage com link no app.

## 15. Design
Clean, respiro generoso (sem grunge). Amarelo `#D59203` de acento, preto/grafite em headers, branco predominante. Inter. Semáforo consistente. Componentes grandes.
Home: Rodrigo — card "Auditoria de hoje" com Iniciar/Continuar, agenda da semana, últimos dias (≤ 2 toques do push ao primeiro item). Daniele — "Nova auditoria" → loja → checklist. Proprietários — dashboard.
Preenchimento: um bloco/área por tela, barra de progresso, "Próximo" fixo; completa abre com pendências; nota 1–2 expande câmera + observação inline; revisão final; concluída = imutável; badge "rascunho" na home. Estados vazios amigáveis; upload com retry + fila local.

## 17. Fases
1 Núcleo (auth, unidades, templates, fluxo do Rodrigo, notas, agenda). 2 Gestão (dashboard, pendências, ranking, fechamento, 99Food). 3 Comunicação (pushes, PDFs). 4 Nutricional.

## 18. Checklist de aceite
- Push 8h → iniciar em ≤ 2 toques · rascunho com autosave · nota 1–2 sem foto não conclui · falha grave zera e limita a 50% com vermelho · 1 auditoria/unidade/tipo/dia; concluída imutável · pendências reaparecem; 2 visitas → push · agenda de 5 semanas sem repetição · alerta 23h sem penalizar a loja · nota mensal ponderada, desempate, elegibilidade ≥ 70%, produto vencido bloqueia, amostra reduzida < 3 · Produção fora do ranking · ajuste exige justificativa e trilha · fechamento congela e gera 2 PDFs · dashboard KPIs → ranking → loja + perfil do auditor · módulo Daniele binário com peso, faixas, banco central, seeds · pt-BR, clean, #D59203.

## Anexos (seeds nutricionais)
Ver `supabase/migrations/0004_seed_nutri.sql` — transcrição fiel dos Anexos A, B e C. Pontos a confirmar com a nutricionista: nome da Área 1 de Moema Salão ("Cozinha / Chapa", cabeçalho ausente na fonte); item "GN na pista com etiqueta" / "Preparações nas pistas com etiqueta" ("com" pode ser intencional ou digitação de "sem").
