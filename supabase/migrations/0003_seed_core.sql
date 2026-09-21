-- =====================================================================
-- Seed: unidades, configurações e templates das auditorias do gerente
-- =====================================================================

insert into units (nome, slug, tipo, ativa, entra_no_ranking, ordem_rotacao) values
  ('Moema Salão',    'moema-salao',    'loja',     true, true,  1),
  ('Moema Delivery', 'moema-delivery', 'loja',     true, true,  2),
  ('Imigrantes',     'imigrantes',     'loja',     true, true,  3),
  ('Bela Vista',     'bela-vista',     'loja',     true, true,  4),
  ('Mooca',          'mooca',          'loja',     true, true,  5),
  ('Moema Produção', 'moema-producao', 'producao', true, false, 0);

insert into app_settings (chave, valor, descricao) values
  ('rotacao_semana_base', '"2026-09-22"', 'Terça-feira da semana 1 da rotação (qua = Moema Salão)'),
  ('premio_valor', '200', 'Prêmio em R$ ao supervisor da loja 1ª colocada'),
  ('elegibilidade_min', '70', 'Nota mensal mínima (%) para premiação'),
  ('amostra_reduzida_min', '3', 'Nº mínimo de auditorias no mês para não receber o selo "amostra reduzida"'),
  ('peso_completa', '2', 'Peso da auditoria completa na nota mensal'),
  ('peso_simplificada', '1', 'Peso da auditoria simplificada na nota mensal'),
  ('nutri_compoe_ranking', 'false', 'Nota nutricional compõe a nota do ranking?'),
  ('nutri_peso', '0', 'Peso da nota nutricional na nota do ranking (quando ativo)'),
  ('food99_compoe_ranking', 'false', 'Indicadores 99Food compõem a nota do ranking?'),
  ('food99_peso', '0', 'Peso dos indicadores 99Food (quando ativo)'),
  ('pendencia_reincidente_visitas', '2', 'Nº de visitas consecutivas sem resolver para disparar alerta de reincidência');

-- ---------- TEMPLATE: AUDITORIA COMPLETA ----------
do $$
declare t uuid; b uuid;
begin
  insert into audit_templates (tipo, versao, nome) values ('completa', 1, 'Auditoria Completa') returning id into t;

  insert into template_blocks (template_id, chave, nome, peso, ordem) values (t, 'pendencias', 'Pendências da visita anterior', 0, 0) returning id into b;
  insert into template_items (block_id, chave, descricao, falha_grave, pendencias, ordem) values
    (b, 'pendencias_anterior', 'Pendências da visita anterior resolvidas', false, true, 1);

  insert into template_blocks (template_id, chave, nome, peso, ordem) values (t, 'seguranca', 'Segurança Alimentar', 20, 1) returning id into b;
  insert into template_items (block_id, chave, descricao, falha_grave, produto_vencido, ordem) values
    (b, 'temperaturas',       'Controle de temperatura dos alimentos (quente/frio)', true, false, 1),
    (b, 'validades_pvps',     'Validade e rotação de insumos — PVPS, sem itens vencidos', true, true, 2),
    (b, 'armazenamento',      'Armazenamento e identificação (etiquetas corretas, estoque organizado)', true, false, 3),
    (b, 'epis',               'Uso correto de EPIs (luvas, touca, proteção)', true, false, 4),
    (b, 'higienizacao_equip', 'Higienização de utensílios e equipamentos (chapa, utensílios)', true, false, 5);

  insert into template_blocks (template_id, chave, nome, peso, ordem) values (t, 'operacao', 'Operação e Produto', 20, 2) returning id into b;
  insert into template_items (block_id, chave, descricao, ordem) values
    (b, 'montagem_peso',  'Padronização de montagem e peso do hambúrguer (ficha técnica)', 1),
    (b, 'ponto_carne',    'Ponto de cocção da carne', 2),
    (b, 'tempo_preparo',  'Tempo de preparo e entrega do pedido', 3),
    (b, 'mise_en_place',  'Organização da linha de produção (mise en place)', 4),
    (b, 'desperdicio',    'Controle de desperdício de insumos', 5);

  insert into template_blocks (template_id, chave, nome, peso, ordem) values (t, 'limpeza', 'Limpeza e Estrutura', 20, 3) returning id into b;
  insert into template_items (block_id, chave, descricao, ordem) values
    (b, 'limpeza_geral',     'Limpeza geral (salão, cozinha, banheiros, área externa)', 1),
    (b, 'descarte_residuos', 'Descarte correto de resíduos e óleo de fritura', 2),
    (b, 'equipamentos',      'Equipamentos funcionando e manutenções em dia', 3),
    (b, 'apresentacao',      'Apresentação geral da loja (organização e padrão visual)', 4);

  insert into template_blocks (template_id, chave, nome, peso, ordem) values (t, 'atendimento', 'Atendimento e Delivery', 20, 4) returning id into b;
  insert into template_items (block_id, chave, descricao, ordem) values
    (b, 'atendimento_cliente', 'Qualidade do atendimento ao cliente', 1),
    (b, 'embalagem_expedicao', 'Embalagem e expedição dos pedidos', 2),
    (b, 'app_delivery',        'Operação no app de delivery no dia (tempo de aceite, cancelamentos)', 3);

  insert into template_blocks (template_id, chave, nome, peso, ordem) values (t, 'equipe', 'Equipe e Gestão', 20, 5) returning id into b;
  insert into template_items (block_id, chave, descricao, ordem) values
    (b, 'uniforme',     'Uniforme limpo, conservado e completo', 1),
    (b, 'pontualidade', 'Pontualidade e cumprimento da escala', 2),
    (b, 'planilhas',    'Preenchimento correto das planilhas e registros de controle', 3),
    (b, 'ambiente',     'Ambiente de trabalho (clima, respeito, colaboração)', 4);
end $$;

-- ---------- TEMPLATE: AUDITORIA SIMPLIFICADA ----------
do $$
declare t uuid; b uuid;
begin
  insert into audit_templates (tipo, versao, nome) values ('simplificada', 1, 'Auditoria Simplificada') returning id into t;
  insert into template_blocks (template_id, chave, nome, peso, ordem) values (t, 'geral', 'Checklist do dia', 1, 1) returning id into b;
  insert into template_items (block_id, chave, descricao, falha_grave, produto_vencido, pendencias, bloco_ref, ordem) values
    (b, 'temperaturas',        'Temperaturas quente/frio', true, false, false, 'seguranca', 1),
    (b, 'validades_pvps',      'Validades e PVPS', true, true, false, 'seguranca', 2),
    (b, 'limpeza_geral',       'Limpeza geral', false, false, false, 'limpeza', 3),
    (b, 'montagem_ponto',      'Montagem e ponto da carne', false, false, false, 'operacao', 4),
    (b, 'tempo_preparo',       'Tempo de preparo dos pedidos', false, false, false, 'operacao', 5),
    (b, 'uniforme',            'Uniforme', false, false, false, 'equipe', 6),
    (b, 'pontualidade',        'Escala cumprida no dia', false, false, false, 'equipe', 7),
    (b, 'mise_en_place',       'Mise en place', false, false, false, 'operacao', 8),
    (b, 'equipamentos',        'Equipamentos funcionando', false, false, false, 'limpeza', 9),
    (b, 'descarte_residuos',   'Descarte de resíduos e óleo', false, false, false, 'limpeza', 10),
    (b, 'planilhas',           'Planilhas do dia preenchidas', false, false, false, 'equipe', 11),
    (b, 'pendencias_anterior', 'Pendências da visita anterior resolvidas', false, false, true, null, 12);
end $$;

-- ---------- TEMPLATE: AUDITORIA DE PRODUÇÃO ----------
do $$
declare t uuid; b uuid;
begin
  insert into audit_templates (tipo, versao, nome) values ('producao', 1, 'Auditoria de Produção') returning id into t;
  insert into template_blocks (template_id, chave, nome, peso, ordem) values (t, 'producao', 'Cozinha central', 1, 1) returning id into b;
  insert into template_items (block_id, chave, descricao, falha_grave, produto_vencido, pendencias, ordem) values
    (b, 'recebimento',         'Recebimento de insumos (conferência, temperatura, qualidade)', false, false, false, 1),
    (b, 'armazenamento',       'Armazenamento (câmaras, estoque seco, identificação)', true, false, false, 2),
    (b, 'producao_ficha',      'Produção conforme ficha técnica (padrão, rendimento)', false, false, false, 3),
    (b, 'validades_pvps',      'Validades e PVPS', true, false, false, 4),
    (b, 'higienizacao_equip',  'Higienização de equipamentos e utensílios', true, false, false, 5),
    (b, 'expedicao',           'Expedição para as lojas (conferência, embalagem, horários)', false, false, false, 6),
    (b, 'limpeza_org',         'Limpeza e organização geral', false, false, false, 7),
    (b, 'planilhas_producao',  'Planilhas de produção preenchidas', false, false, false, 8),
    (b, 'pendencias_anterior', 'Pendências da visita anterior', false, false, true, 9);
end $$;

-- ---------- TEMPLATE: NUTRICIONAL (engine própria; itens vêm do banco/composição) ----------
insert into audit_templates (tipo, versao, nome) values ('nutricional', 1, 'Auditoria Nutricional');
