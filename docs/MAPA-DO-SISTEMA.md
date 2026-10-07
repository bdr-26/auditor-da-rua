# Mapa do ROTA — perfis, rotinas e fluxos

Visão de negócio do sistema (para quem opera). Detalhes técnicos: `ARQUITETURA.md`, `FLUXO-AUDITOR.md`, `DASHBOARD.md`, `MODULO-NUTRICIONAL.md`, `NOTIFICACOES.md`.

## Perfis

| Perfil | Quem | O que vê e faz |
|---|---|---|
| Proprietário | Antonio, Victor | Dashboard (ranking, nota do mês, pendências, calendário), rotina do gerente (gerar/trocar/mover/remover), auditoria surpresa, fechamento e premiação, demandas (inclui checklist de abertura), Admin (Unidades, Equipe e acessos, Critérios), módulo nutri em leitura com o painel da chefe, PDFs/WhatsApp. |
| Gerente (auditor geral) | Rodrigo | Loja do dia com endereço e demandas, agenda da rotação (qua–dom; produção às terças), auditorias completa/simplificada/produção com fotos, resumo + assinatura do supervisor + PDF, demandas atribuídas e pessoais, visita de abertura nas lojas em abertura, histórico. |
| Nutricionista chefe | Daniele | Painel da equipe, rotina padrão, agenda da equipe, conferência dos controles, vencimentos, checklists (banco, pesos, composição por unidade); vê/edita tudo das estagiárias. |
| Equipe de qualidade | Laís, Letícia (nível "estagiária") | Tarefas de hoje, auditoria nutricional (rascunho → concluída; NC com foto, "corrigido na hora", orientação), controles (rascunho → finalizado), assinatura da equipe e do supervisor, PDFs. Só o que é delas. |

## Rotina do gerente

1. **Rotação das lojas** (ordem em Unidades) gera a agenda qua–dom; terça = cozinha central. Lojas em abertura viram "visita de abertura" (checklist via demandas), sem nota.
2. **Lembrete das 8h** com loja, endereço e demandas. Proprietários editam a rotina a qualquer hora.
3. **Auditoria** por blocos com peso, notas 1–5, fotos, falha grave, produto vencido, "o que conferir" por item; autosave offline.
4. **Resumo**: nota, pontos perdidos, pendências anteriores, assinatura do supervisor, PDF e WhatsApp.
5. **Nota do mês e ranking**: média por loja, amostra reduzida, elegibilidade; auditorias surpresa contam igual.
6. **Fechamento**: indicadores externos, ajustes, relatórios PDF, loja premiada.

## Rotina da nutrição

1. **Rotina padrão** (`/nutri/agenda/rotina`): por unidade, responsável e dias da semana ou dia do mês. Moema diária (Laís), Imigrantes/Bela Vista/Mooca semanal, Café da Rua mensal. A agenda dos próximos 30 dias é completada às 8h.
2. **Lembrete e tarefa do dia** com atalho para iniciar auditoria ou controle.
3. **Controles (as planilhas)**: temperatura de equipamentos e distribuição, óleo, recebimento, transportados, hortifrúti, amostras, manutenção, conferência das planilhas, pasta de documentação, enxoval de RH. Faixas com alerta; rascunho → finalizado; PDF e compilação mensal.
4. **Auditoria nutricional**: checklist da unidade, conforme/NC/N.A., foto, corrigido na hora, orientação, pendências da visita anterior.
5. **Assinatura dupla** (equipe + supervisor) e PDF para o grupo.
6. **Acompanhamento da chefe**: painel, conferência, vencimentos, relatório mensal nutricional.

## As planilhas dentro do sistema

As planilhas do Drive viraram **Controles** no app, preenchidos pela equipe de nutrição no celular. Funcionários de loja não têm login: onde há estagiária (Moema) ela preenche no app; nas demais casas a planilha de papel continua e a visita semanal registra a **Conferência das planilhas** (preenchida/parcial/não, dias faltantes, orientação). Para funcionários preencherem no app seria preciso um perfil de loja (não existe hoje).

## O que roda sozinho

| Quando | O que | Quem recebe |
|---|---|---|
| Todo dia 8h | Gera agenda do gerente; lembrete da loja do dia | Rodrigo |
| Todo dia 8h | Completa agenda da nutrição (rotina padrão) e lembra as tarefas | Dani, Laís, Letícia |
| Semanal | Documentos/exames vencidos ou vencendo em 30 dias | Dani e proprietários |
| Todo dia 23h05 | Marca visita do gerente não realizada como não cumprida | Agenda |
| Ao concluir auditoria | Push com nota e link | Proprietários |
| Ao criar demanda/tarefa | Push para quem executa | Rodrigo / equipe nutri |
| Ao fechar o mês | Relatórios PDF com link de 7 dias | Proprietários |

## Unidades

| Unidade | Gerente | Nutrição | Situação |
|---|---|---|---|
| Moema Salão / Delivery | Rotação e ranking | Diária (recebimento e amostras) | ativa |
| Imigrantes | Rotação e ranking | Semanal | ativa |
| Bela Vista / Mooca | Visita de abertura | Entra na rotina ao ativar | em abertura |
| Moema Produção | Terças, fora do ranking | Conforme rotina | ativa |
| Café da Rua | Não participa | Mensal (etiquetas de Moema) | só nutrição |

## Onde se configura

| Ajuste | Onde | Quem |
|---|---|---|
| Lojas, ordem, em abertura, só nutrição, supervisor, endereço | Admin → Unidades | Proprietário |
| Logins, senha, nível nutri | Admin → Equipe e acessos | Proprietário |
| Pesos, falha grave, prêmio, nota mínima | Admin → Critérios | Proprietário |
| Rotina do gerente | Dashboard → Rotina | Proprietário |
| Checklist nutricional por unidade | Nutrição → Checklists | Dani |
| Rotina padrão / tarefa avulsa | Nutrição → Agenda | Dani |
| Novo tipo de planilha | Código (`CONTROLE_TIPOS`) | Dev |
